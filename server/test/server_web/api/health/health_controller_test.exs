defmodule ServerWeb.Api.Health.HealthControllerTest do
  use ServerWeb.ConnCase, async: false

  import OpenApiSpex.TestAssertions, only: [assert_response_schema: 3]

  alias ServerWeb.ApiSpec

  setup do
    repos = Application.fetch_env!(:server, :ecto_repos)
    role = Application.fetch_env!(:server, :server_role)

    on_exit(fn ->
      Application.put_env(:server, :ecto_repos, repos)
      Application.put_env(:server, :server_role, role)
    end)

    {:ok, repos: repos}
  end

  test "liveness responds even when a repository is unavailable", %{conn: conn} do
    Application.put_env(:server, :ecto_repos, [__MODULE__.UnavailableRepo])

    conn = get(conn, ~p"/health/live")

    response = json_response(conn, 200)
    assert response == %{"status" => "ok"}
    assert_response_schema(response, "HealthResponse", ApiSpec.spec())
    assert get_resp_header(conn, "cache-control") == ["no-store"]
  end

  test "readiness succeeds when all selected repositories answer", %{conn: conn} do
    conn = get(conn, ~p"/health/ready")

    response = json_response(conn, 200)
    assert response == %{"status" => "ok"}
    assert_response_schema(response, "HealthResponse", ApiSpec.spec())
    assert get_resp_header(conn, "cache-control") == ["no-store"]
  end

  test "readiness fails when a selected repository is unavailable", %{
    conn: conn,
    repos: repos
  } do
    Application.put_env(
      :server,
      :ecto_repos,
      repos ++ [__MODULE__.UnavailableRepo]
    )

    conn = get(conn, ~p"/health/ready")

    response = json_response(conn, 503)
    assert response == %{"status" => "unavailable"}
    assert_response_schema(response, "HealthResponse", ApiSpec.spec())
    assert get_resp_header(conn, "cache-control") == ["no-store"]
  end

  test "readiness fails when no repositories are configured", %{conn: conn} do
    Application.put_env(:server, :ecto_repos, [])

    conn = get(conn, ~p"/health/ready")

    response = json_response(conn, 503)
    assert response == %{"status" => "unavailable"}
    assert_response_schema(response, "HealthResponse", ApiSpec.spec())
    assert get_resp_header(conn, "cache-control") == ["no-store"]
  end

  test "health remains available with correlated responses for every role", %{conn: conn} do
    request_id = "request-id-for-forwarded-health"

    for role <- [:all, :identity, :content], path <- [~p"/health/live", ~p"/health/ready"] do
      Application.put_env(:server, :server_role, role)

      result =
        conn
        |> put_req_header("x-request-id", request_id)
        |> get(path)

      assert json_response(result, 200) == %{"status" => "ok"}
      assert get_resp_header(result, "cache-control") == ["no-store"]
      assert get_resp_header(result, "x-request-id") == [request_id]
    end
  end
end
