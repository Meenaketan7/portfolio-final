defmodule ServerWeb.Errors.ErrorJSONTest do
  use ServerWeb.ConnCase, async: true

  alias Ecto.Changeset
  alias ServerWeb.Errors.ErrorFixture
  alias ServerWeb.Errors.ErrorJSON

  test "renders stable codes and compatible messages for supported errors" do
    cases = [
      {400, "bad_request", "Bad Request"},
      {401, "unauthorized", "Unauthorized"},
      {403, "forbidden", "Forbidden"},
      {404, "not_found", "Not Found"},
      {405, "method_not_allowed", "Method Not Allowed"},
      {406, "not_acceptable", "Not Acceptable"},
      {409, "conflict", "Conflict"},
      {410, "gone", "Gone"},
      {413, "payload_too_large", "Request Entity Too Large"},
      {415, "unsupported_media_type", "Unsupported Media Type"},
      {422, "validation_failed", "Unprocessable Content"},
      {429, "rate_limited", "Too Many Requests"},
      {500, "internal_server_error", "Internal Server Error"},
      {502, "bad_gateway", "Bad Gateway"},
      {503, "service_unavailable", "Service Unavailable"},
      {504, "gateway_timeout", "Gateway Timeout"}
    ]

    for {status, code, message} <- cases do
      assert ErrorJSON.render("#{status}.json", %{}) == %{
               code: code,
               message: message,
               errors: %{detail: message}
             }
    end
  end

  test "uses the generic code for an unmapped HTTP status" do
    assert ErrorJSON.render("418.json", %{}) == %{
             code: "request_failed",
             message: "I'm a teapot",
             errors: %{detail: "I'm a teapot"}
           }
  end

  test "uses a safe response for an unknown template" do
    assert ErrorJSON.render("unknown.json", %{}) == %{
             code: "request_failed",
             message: "Internal Server Error",
             errors: %{detail: "Internal Server Error"}
           }
  end

  test "does not expose exception details or accept response overrides from assigns" do
    assigns = %{
      code: "database_failure",
      message: "private exception details",
      errors: %{detail: "private database path"},
      reason: RuntimeError.exception("private credentials"),
      stack: [{__MODULE__, :private_function, 0, []}]
    }

    assert ErrorJSON.render("500.json", assigns) == %{
             code: "internal_server_error",
             message: "Internal Server Error",
             errors: %{detail: "Internal Server Error"}
           }
  end

  test "includes the request ID from render assigns" do
    request_id = "request-id-for-error-response"

    assert ErrorJSON.render("500.json", %{request_id: request_id}) == %{
             code: "internal_server_error",
             message: "Internal Server Error",
             errors: %{detail: "Internal Server Error"},
             requestId: request_id
           }
  end

  test "omits request IDs without a binary assign" do
    for assigns <- [%{}, %{request_id: nil}, %{request_id: 123}, %{"request_id" => "ignored"}] do
      refute Map.has_key?(ErrorJSON.render("404.json", assigns), :requestId)
    end
  end

  test "renders the error contract for unknown routes through the endpoint", %{conn: conn} do
    result =
      conn
      |> put_req_header("accept", "application/json")
      |> get("/api/v1/not-a-route")

    assert [request_id] = get_resp_header(result, "x-request-id")
    assert byte_size(request_id) in 20..200
    assert result.assigns.request_id == request_id

    assert json_response(result, 404) == %{
             "code" => "not_found",
             "message" => "Not Found",
             "errors" => %{"detail" => "Not Found"},
             "requestId" => request_id
           }
  end

  test "preserves incoming request IDs at both accepted length boundaries", %{conn: conn} do
    for size <- [20, 200] do
      request_id = String.duplicate("r", size)

      result =
        conn
        |> put_req_header("accept", "application/json")
        |> put_req_header("x-request-id", request_id)
        |> get("/api/v1/not-a-route")

      assert get_resp_header(result, "x-request-id") == [request_id]
      assert %{"requestId" => ^request_id, "code" => "not_found"} = json_response(result, 404)
    end
  end

  test "replaces incoming request IDs outside the accepted length range", %{conn: conn} do
    for size <- [0, 19, 201] do
      supplied_id = String.duplicate("r", size)

      result =
        conn
        |> put_req_header("accept", "application/json")
        |> put_req_header("x-request-id", supplied_id)
        |> get("/api/v1/not-a-route")

      assert [request_id] = get_resp_header(result, "x-request-id")
      assert byte_size(request_id) in 20..200
      refute request_id == supplied_id
      assert %{"requestId" => ^request_id, "code" => "not_found"} = json_response(result, 404)
    end
  end

  test "does not carry a supplied request ID into the next request", %{conn: conn} do
    supplied_id = "request-id-for-first-request"

    first =
      conn
      |> put_req_header("accept", "application/json")
      |> put_req_header("x-request-id", supplied_id)
      |> get("/api/v1/not-a-route")

    assert %{"requestId" => ^supplied_id} = json_response(first, 404)

    second =
      conn
      |> put_req_header("accept", "application/json")
      |> get("/api/v1/not-a-route")

    assert [request_id] = get_resp_header(second, "x-request-id")
    refute request_id == supplied_id
    assert %{"requestId" => ^request_id} = json_response(second, 404)
  end

  test "renders required field errors while preserving the envelope and request ID" do
    changeset =
      {%{}, %{email: :string}}
      |> Changeset.cast(%{}, [:email])
      |> Changeset.validate_required([:email])

    request_id = "request-id-for-validation"

    assert ErrorJSON.render("422.json", %{changeset: changeset, request_id: request_id}) == %{
             code: "validation_failed",
             message: "Unprocessable Content",
             errors: %{
               detail: "Unprocessable Content",
               fields: %{email: [%{code: "required", message: "can't be blank"}]}
             },
             requestId: request_id
           }
  end

  test "renders format errors and uses the safe fallback for cast errors" do
    changeset =
      {%{}, %{email: :string, age: :integer}}
      |> Changeset.cast(%{email: "invalid", age: "not-a-number"}, [:email, :age])
      |> Changeset.validate_format(:email, ~r/@/)

    response = ErrorJSON.render("422.json", %{changeset: changeset})

    assert response.errors.fields == %{
             email: [%{code: "invalid_format", message: "has invalid format"}],
             age: [%{code: "invalid", message: "is invalid"}]
           }
  end

  test "preserves multiple validation errors for the same field" do
    changeset =
      {%{}, %{email: :string}}
      |> Changeset.cast(%{email: "invalid"}, [:email])
      |> Changeset.validate_format(:email, ~r/@/)
      |> Changeset.add_error(:email, "custom internal message", validation: :custom)

    response = ErrorJSON.render("422.json", %{changeset: changeset})

    assert Enum.sort_by(response.errors.fields.email, & &1.code) == [
             %{code: "invalid", message: "is invalid"},
             %{code: "invalid_format", message: "has invalid format"}
           ]
  end

  test "does not expose submitted values, custom messages, or constraint metadata" do
    private_value = "private-submitted-token"
    private_constraint = "private_database_constraint"

    for validation <- [:required, :format, :custom] do
      changeset =
        {%{}, %{email: :string}}
        |> Changeset.cast(%{email: private_value}, [:email])
        |> Changeset.add_error(:email, "rejected #{private_value}",
          validation: validation,
          constraint: :unique,
          constraint_name: private_constraint,
          rejected_value: private_value
        )

      response = ErrorJSON.render("422.json", %{changeset: changeset})
      encoded = Jason.encode!(response)

      assert [%{code: code, message: message}] = response.errors.fields.email
      assert code in ["required", "invalid_format", "invalid"]
      assert message in ["can't be blank", "has invalid format", "is invalid"]
      refute String.contains?(encoded, [private_value, private_constraint, "rejected"])
      refute Map.has_key?(response, :changeset)
    end
  end

  test "preserves nested errors and positions of valid children" do
    valid = Changeset.change(%ErrorFixture{name: "Valid"})

    invalid =
      %ErrorFixture{}
      |> Changeset.change()
      |> Changeset.validate_required([:name])

    changeset =
      %ErrorFixture{}
      |> Changeset.change()
      |> Changeset.put_embed(:profile, invalid)
      |> Changeset.put_embed(:items, [valid, invalid])

    response = ErrorJSON.render("422.json", %{changeset: changeset})
    name_errors = [%{code: "required", message: "can't be blank"}]

    assert response.errors.fields == %{
             profile: %{name: name_errors},
             items: [%{}, %{name: name_errors}]
           }

    assert Jason.decode!(Jason.encode!(response))["errors"]["fields"]["items"] == [
             %{},
             %{"name" => [%{"code" => "required", "message" => "can't be blank"}]}
           ]
  end

  test "does not attach changeset field errors to other HTTP statuses" do
    changeset =
      {%{}, %{email: :string}}
      |> Changeset.cast(%{}, [:email])
      |> Changeset.validate_required([:email])

    for template <- ["400.json", "404.json", "500.json"] do
      assert ErrorJSON.render(template, %{changeset: changeset}) ==
               ErrorJSON.render(template, %{})
    end
  end

  test "retains the generic 422 response without an actual changeset" do
    for assigns <- [%{}, %{changeset: nil}, %{changeset: %{errors: [email: "invalid"]}}] do
      assert ErrorJSON.render("422.json", assigns) == %{
               code: "validation_failed",
               message: "Unprocessable Content",
               errors: %{detail: "Unprocessable Content"}
             }
    end
  end
end
