defmodule ServerWeb.Api.Health.HealthResponse do
  @moduledoc "OpenAPI contract for health check responses."

  alias OpenApiSpex.Schema

  require OpenApiSpex

  OpenApiSpex.schema(
    %{
      title: "HealthResponse",
      description: "The result of a liveness or readiness check.",
      type: :object,
      additionalProperties: false,
      required: [:status],
      properties: %{
        status: %Schema{
          type: :string,
          enum: ["ok", "unavailable"]
        }
      },
      example: %{"status" => "ok"}
    },
    struct?: false,
    derive?: false
  )
end
