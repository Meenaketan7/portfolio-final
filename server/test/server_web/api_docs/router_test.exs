defmodule ServerWeb.ApiDocs.RouterTest do
  use ExUnit.Case, async: false

  import Phoenix.ConnTest, only: [html_response: 2, json_response: 2]
  import Plug.Conn
  import Plug.Test

  alias ServerWeb.ApiDocs.Router
  alias ServerWeb.ApiSpec

  setup do
    settings = [
      {:server, :server_role},
      {:open_api_spex, :cache_adapter}
    ]

    original =
      Enum.map(settings, fn {app, key} -> {app, key, Application.fetch_env(app, key)} end)

    Application.put_env(:open_api_spex, :cache_adapter, OpenApiSpex.Plug.NoneCache)

    on_exit(fn ->
      for {app, key, value} <- original do
        case value do
          {:ok, value} -> Application.put_env(app, key, value)
          :error -> Application.delete_env(app, key)
        end
      end
    end)

    :ok
  end

  test "serves the generated specification as non-cacheable JSON for every role" do
    for role <- [:all, :identity, :content] do
      Application.put_env(:server, :server_role, role)

      result =
        conn(:get, "/openapi.json")
        |> put_req_header("accept", "application/json")
        |> Router.call(Router.init([]))

      document = json_response(result, 200)
      assert document == ApiSpec.spec() |> Jason.encode!() |> Jason.decode!()
      assert get_resp_header(result, "cache-control") == ["no-store"]
      assert document["paths"]["/health/ready"]["get"]["responses"]["503"]
    end
  end

  test "serves Scalar with a pinned asset and the local specification" do
    result =
      conn(:get, "/api")
      |> put_req_header("accept", "text/html")
      |> Router.call(Router.init([]))

    body = html_response(result, 200)
    assert body =~ "<title>Server API Reference</title>"
    assert body =~ "@scalar/api-reference@1.81.0/esm.js"
    assert body =~ "url: '/dev/openapi.json'"
    assert body =~ "proxyUrl: ''"
    assert body =~ "withDefaultFonts: false"
    assert body =~ "<noscript>"
    assert get_resp_header(result, "cache-control") == ["no-store"]
    assert get_resp_header(result, "x-content-type-options") == ["nosniff"]

    [nonce] = Regex.run(~r/<script type="module" nonce="([^"]+)">/, body, capture: :all_but_first)
    [policy] = get_resp_header(result, "content-security-policy")
    assert policy =~ "script-src 'self' https://cdn.jsdelivr.net 'nonce-#{nonce}'"
  end

  test "uses a fresh script nonce for each reference page" do
    policies =
      for _ <- 1..2 do
        result = conn(:get, "/api") |> Router.call(Router.init([]))
        [policy] = get_resp_header(result, "content-security-policy")
        policy
      end

    assert length(Enum.uniq(policies)) == 2

    for policy <- policies do
      script_policy =
        policy |> String.split(";") |> Enum.find(&String.contains?(&1, "script-src"))

      refute script_policy =~ "'unsafe-inline'"
    end
  end

  test "keeps documentation and development tools out of the served API paths" do
    result = conn(:get, "/openapi.json") |> Router.call(Router.init([]))
    paths = json_response(result, 200)["paths"]

    assert Enum.sort(Map.keys(paths)) == ["/health/live", "/health/ready"]
  end
end
