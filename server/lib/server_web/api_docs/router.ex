defmodule ServerWeb.ApiDocs.Router do
  @moduledoc "Development API documentation routes, mounted only when dev_routes is enabled."

  use ServerWeb, :router

  pipeline :spec do
    plug :accepts, ["json"]
    plug :no_store
    plug OpenApiSpex.Plug.PutApiSpec, module: ServerWeb.ApiSpec
  end

  pipeline :browser do
    plug :accepts, ["html"]

    plug :put_secure_browser_headers, %{
      "content-security-policy" =>
        "default-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:"
    }
  end

  scope "/" do
    pipe_through :spec

    get "/openapi.json", OpenApiSpex.Plug.RenderSpec, []
  end

  scope "/", ServerWeb.ApiDocs do
    pipe_through :browser

    get "/api", ReferenceController, :show
  end

  defp no_store(conn, _opts), do: put_resp_header(conn, "cache-control", "no-store")
end
