defmodule ServerWeb.RouterTest do
  use ExUnit.Case, async: false

  import Plug.Conn
  import Plug.Test

  alias ServerWeb.Endpoint
  alias ServerWeb.Router

  setup do
    original_role = Application.fetch_env!(:server, :server_role)

    on_exit(fn ->
      Application.put_env(:server, :server_role, original_role)
    end)

    :ok
  end

  test "hides routes belonging to another service role" do
    for {role, path} <- [
          {:identity, "/api/v1/content"},
          {:content, "/api/v1/identity"}
        ],
        accept <- ["application/json", "text/plain"] do
      Application.put_env(:server, :server_role, role)

      result =
        conn(:get, path)
        |> put_req_header("accept", accept)
        |> Router.call(Router.init([]))

      assert result.halted
      assert result.status == 404

      assert Jason.decode!(result.resp_body) == %{
               "code" => "not_found",
               "message" => "Not Found",
               "errors" => %{"detail" => "Not Found"}
             }
    end
  end

  test "correlates disabled-domain errors through the endpoint" do
    request_id = "request-id-for-disabled-domain"

    for {role, path} <- [
          {:identity, "/api/v1/content"},
          {:content, "/api/v1/identity"}
        ] do
      Application.put_env(:server, :server_role, role)

      result =
        conn(:get, path)
        |> put_req_header("accept", "application/json")
        |> put_req_header("x-request-id", request_id)
        |> Endpoint.call(Endpoint.init([]))

      assert result.halted
      assert result.status == 404
      assert get_resp_header(result, "x-request-id") == [request_id]

      assert Jason.decode!(result.resp_body) == %{
               "code" => "not_found",
               "message" => "Not Found",
               "errors" => %{"detail" => "Not Found"},
               "requestId" => request_id
             }
    end
  end

  test "renders unknown routes through every feature mount for every role" do
    request_id = "request-id-for-unknown-feature-route"

    for role <- [:all, :identity, :content],
        path <- [
          "/not-a-route",
          "/health/not-a-route",
          "/api/v1/identity/not-a-route",
          "/api/v1/content/not-a-route"
        ] do
      Application.put_env(:server, :server_role, role)

      result =
        conn(:get, path)
        |> put_req_header("accept", "application/json")
        |> put_req_header("x-request-id", request_id)
        |> Endpoint.call(Endpoint.init([]))

      assert result.status == 404
      assert get_resp_header(result, "x-request-id") == [request_id]

      assert Jason.decode!(result.resp_body) == %{
               "code" => "not_found",
               "message" => "Not Found",
               "errors" => %{"detail" => "Not Found"},
               "requestId" => request_id
             }
    end
  end

  test "forwards permitted domains to their child router" do
    for {role, path, child_router} <- [
          {:all, "/api/v1/identity", ServerWeb.Api.Identity.Router},
          {:all, "/api/v1/content", ServerWeb.Api.Content.Router},
          {:identity, "/api/v1/identity", ServerWeb.Api.Identity.Router},
          {:content, "/api/v1/content", ServerWeb.Api.Content.Router}
        ] do
      Application.put_env(:server, :server_role, role)

      error =
        assert_raise Plug.Conn.WrapperError, fn ->
          conn(:get, path)
          |> put_req_header("accept", "application/json")
          |> Router.call(Router.init([]))
        end

      assert %Phoenix.Router.NoRouteError{router: ^child_router} = error.reason
    end
  end

  test "does not mount documentation when development routes are disabled" do
    refute Application.get_env(:server, :dev_routes, false)

    for role <- [:all, :identity, :content], path <- ["/dev/api", "/dev/openapi.json"] do
      Application.put_env(:server, :server_role, role)

      result =
        conn(:get, path)
        |> put_req_header("accept", "application/json")
        |> Endpoint.call(Endpoint.init([]))

      assert result.status == 404
      assert Jason.decode!(result.resp_body)["code"] == "not_found"
    end
  end
end
