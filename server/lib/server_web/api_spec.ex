defmodule ServerWeb.ApiSpec do
  @moduledoc "Builds the backend OpenAPI document."

  alias OpenApiSpex.{Components, Info, OpenApi, Paths, Server}
  alias ServerWeb.Errors.ErrorResponse

  @feature_routers [
    {ServerWeb.Api.Health.Router, "/health", [:all, :identity, :content]},
    {ServerWeb.Api.Identity.Router, "/api/v1/identity", [:all, :identity]},
    {ServerWeb.Api.Content.Router, "/api/v1/content", [:all, :content]}
  ]

  @behaviour OpenApi

  @impl OpenApi
  def spec do
    %OpenApi{
      info: %Info{
        title: "Server API",
        version: "0.1.0"
      },
      servers: [%Server{url: "/"}],
      paths: paths_for_role(Application.fetch_env!(:server, :server_role)),
      components: %Components{
        schemas: %{
          "ErrorResponse" => ErrorResponse.schema()
        }
      }
    }
    |> OpenApiSpex.resolve_schema_modules()
  end

  @doc false
  def paths_for_role(role, feature_routers \\ @feature_routers) do
    feature_routers
    |> Enum.filter(fn {_router, _prefix, roles} -> role in roles end)
    |> Enum.flat_map(&prefixed_routes/1)
    |> Paths.from_routes()
  end

  defp prefixed_routes({router, prefix, _roles}) do
    Enum.map(router.__routes__(), fn route ->
      path = if route.path == "/", do: prefix, else: prefix <> route.path
      %{route | path: path}
    end)
  end
end
