defmodule ServerWeb.Plugs.RequireRoleTest do
  use ExUnit.Case, async: false

  import Plug.Test

  alias ServerWeb.Plugs.RequireRole

  setup do
    original_role = Application.fetch_env!(:server, :server_role)

    on_exit(fn ->
      Application.put_env(:server, :server_role, original_role)
    end)

    :ok
  end

  test "allows the all role and the matching service role" do
    for {role, allowed_roles} <- [
          {:all, [:all, :identity]},
          {:identity, [:all, :identity]},
          {:content, [:all, :content]}
        ] do
      Application.put_env(:server, :server_role, role)

      result = conn(:get, "/") |> RequireRole.call(allowed_roles)

      refute result.halted
    end
  end

  test "returns JSON 404 for a different service role" do
    for {role, allowed_roles} <- [
          {:identity, [:all, :content]},
          {:content, [:all, :identity]}
        ] do
      Application.put_env(:server, :server_role, role)

      result = conn(:get, "/") |> RequireRole.call(allowed_roles)

      assert result.halted
      assert result.status == 404
      assert [content_type] = Plug.Conn.get_resp_header(result, "content-type")
      assert String.starts_with?(content_type, "application/json")

      assert Jason.decode!(result.resp_body) == %{
               "code" => "not_found",
               "message" => "Not Found",
               "errors" => %{"detail" => "Not Found"}
             }
    end
  end

  test "includes the upstream request ID when rejecting a service role" do
    Application.put_env(:server, :server_role, :identity)

    result =
      conn(:get, "/")
      |> Plug.RequestId.call(Plug.RequestId.init(assign_as: :request_id))
      |> RequireRole.call([:all, :content])

    assert result.halted
    assert result.status == 404
    assert [request_id] = Plug.Conn.get_resp_header(result, "x-request-id")

    assert Jason.decode!(result.resp_body) == %{
             "code" => "not_found",
             "message" => "Not Found",
             "errors" => %{"detail" => "Not Found"},
             "requestId" => request_id
           }
  end
end
