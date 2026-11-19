defmodule ServerWeb.Errors.ErrorResponseTest do
  use ExUnit.Case, async: true

  import OpenApiSpex.TestAssertions, only: [assert_raw_schema: 3]
  import Plug.Conn
  import Plug.Test

  alias Ecto.Changeset
  alias OpenApiSpex.Components
  alias OpenApiSpex.Info
  alias OpenApiSpex.OpenApi
  alias ServerWeb.Endpoint
  alias ServerWeb.Errors.ErrorFixture
  alias ServerWeb.Errors.ErrorJSON
  alias ServerWeb.Errors.ErrorResponse

  setup do
    spec =
      OpenApiSpex.resolve_schema_modules(%OpenApi{
        info: %Info{title: "Error response contract", version: "1.0.0"},
        paths: %{},
        components: %Components{schemas: %{"ErrorResponse" => ErrorResponse.schema()}}
      })

    %{spec: spec, schema: spec.components.schemas["ErrorResponse"]}
  end

  test "accepts generic rendered JSON with optional fields absent", %{schema: schema, spec: spec} do
    for template <- ~w(400.json 401.json 403.json 404.json 405.json 406.json 409.json
                       410.json 413.json 415.json 422.json 429.json 500.json 502.json
                       503.json 504.json unknown.json) do
      response = render_json(template)

      refute Map.has_key?(response, "requestId")
      refute Map.has_key?(response["errors"], "fields")
      assert_raw_schema(response, schema, spec)
    end
  end

  test "accepts real endpoint errors with matching generated and Unicode request IDs", %{
    schema: schema,
    spec: spec
  } do
    unicode_id = String.duplicate("あ", 7)
    assert byte_size(unicode_id) >= 20
    assert String.length(unicode_id) < 20

    for supplied_id <- [nil, unicode_id] do
      request = conn(:get, "/api/v1/unknown-contract-route")

      request =
        if supplied_id do
          put_req_header(request, "x-request-id", supplied_id)
        else
          request
        end

      result =
        request
        |> put_req_header("accept", "application/json")
        |> Endpoint.call(Endpoint.init([]))

      assert result.status == 404
      assert [request_id] = get_resp_header(result, "x-request-id")
      if supplied_id, do: assert(request_id == supplied_id)

      response = Jason.decode!(result.resp_body)
      assert response["requestId"] == request_id
      assert_raw_schema(response, schema, spec)
    end
  end

  test "accepts complete nested validation responses and preserves child positions", %{
    schema: schema,
    spec: spec
  } do
    valid = Changeset.change(%ErrorFixture{name: "Valid"})

    invalid =
      %ErrorFixture{}
      |> Changeset.change()
      |> Changeset.validate_required([:name])

    changeset =
      %ErrorFixture{}
      |> Changeset.change()
      |> Changeset.validate_required([:name])
      |> Changeset.put_embed(:profile, invalid)
      |> Changeset.put_embed(:items, [valid, invalid])

    response =
      render_json("422.json", %{changeset: changeset, request_id: "validation-request-id"})

    assert response["code"] == "validation_failed"
    assert [%{}, _invalid_child] = response["errors"]["fields"]["items"]
    assert_raw_schema(response, schema, spec)
  end

  test "omits non-UTF-8 request IDs without breaking endpoint error JSON", %{
    schema: schema,
    spec: spec
  } do
    request_id = String.duplicate(<<255>>, 20)

    result =
      conn(:get, "/api/v1/unknown-contract-route")
      |> put_req_header("accept", "application/json")
      |> put_req_header("x-request-id", request_id)
      |> Endpoint.call(Endpoint.init([]))

    assert result.status == 404
    assert get_resp_header(result, "x-request-id") == [request_id]

    response = Jason.decode!(result.resp_body)
    refute Map.has_key?(response, "requestId")
    assert_raw_schema(response, schema, spec)
  end

  test "accepts empty, short, and Unicode IDs from direct rendering", %{
    schema: schema,
    spec: spec
  } do
    for request_id <- ["", "short-id", "識別子"] do
      assert_raw_schema(render_json("404.json", %{request_id: request_id}), schema, spec)
    end
  end

  test "the documented example conforms to the schema", %{schema: schema, spec: spec} do
    assert_raw_schema(schema.example, schema, spec)
  end

  test "exports all three schema components and nested references", %{spec: spec} do
    document = spec |> Jason.encode!() |> Jason.decode!()
    schemas = document["components"]["schemas"]

    assert Enum.sort(Map.keys(schemas)) == ["ErrorResponse", "FieldError", "FieldErrors"]

    assert schemas["ErrorResponse"]["properties"]["errors"]["properties"]["fields"] == %{
             "$ref" => "#/components/schemas/FieldErrors"
           }

    refute Map.has_key?(schemas["ErrorResponse"], "x-struct")
  end

  test "rejects missing required root and detail properties", %{schema: schema, spec: spec} do
    response = render_json("404.json")

    for property <- ["code", "message", "errors"] do
      assert {:error, [_ | _]} =
               OpenApiSpex.cast_value(Map.delete(response, property), schema, spec)
    end

    assert {:error, [_ | _]} =
             OpenApiSpex.cast_value(%{response | "errors" => %{}}, schema, spec)
  end

  test "rejects empty or incorrectly typed required strings", %{schema: schema, spec: spec} do
    response = render_json("404.json")

    for property <- ["code", "message"], value <- ["", nil, true, 123, [], %{}] do
      assert {:error, [_ | _]} =
               OpenApiSpex.cast_value(Map.put(response, property, value), schema, spec)
    end

    for detail <- ["", nil, true, 123, [], %{}] do
      assert {:error, [_ | _]} =
               OpenApiSpex.cast_value(
                 put_in(response, ["errors", "detail"], detail),
                 schema,
                 spec
               )
    end
  end

  test "rejects unexpected properties at both envelope levels", %{schema: schema, spec: spec} do
    response = render_json("404.json")

    for value <- [
          Map.put(response, "stack", "private stack"),
          put_in(response, ["errors", "database"], "private database path")
        ] do
      assert {:error, [_ | _]} = OpenApiSpex.cast_value(value, schema, spec)
    end
  end

  test "rejects malformed optional fields and non-string request IDs", %{
    schema: schema,
    spec: spec
  } do
    response = render_json("422.json")

    for fields <- [nil, [], "invalid", %{"email" => []}, %{"email" => [%{"code" => "unknown"}]}] do
      assert {:error, [_ | _]} =
               OpenApiSpex.cast_value(
                 put_in(response, ["errors", "fields"], fields),
                 schema,
                 spec
               )
    end

    for request_id <- [nil, true, 123, [], %{}] do
      assert {:error, [_ | _]} =
               OpenApiSpex.cast_value(Map.put(response, "requestId", request_id), schema, spec)
    end
  end

  defp render_json(template, assigns \\ %{}) do
    template
    |> ErrorJSON.render(assigns)
    |> Jason.encode!()
    |> Jason.decode!()
  end
end
