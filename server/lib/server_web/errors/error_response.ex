defmodule ServerWeb.Errors.ErrorResponse do
  @moduledoc "OpenAPI contract for the shared JSON error response."

  alias OpenApiSpex.Schema
  alias ServerWeb.Errors.FieldErrors

  require OpenApiSpex

  OpenApiSpex.schema(
    %{
      title: "ErrorResponse",
      description: "A shared API error response.",
      type: :object,
      additionalProperties: false,
      required: [:code, :message, :errors],
      properties: %{
        code: %Schema{
          type: :string,
          minLength: 1
        },
        message: %Schema{
          type: :string,
          minLength: 1
        },
        errors: %Schema{
          type: :object,
          additionalProperties: false,
          required: [:detail],
          properties: %{
            detail: %Schema{
              type: :string,
              minLength: 1
            },
            fields: FieldErrors
          }
        },
        requestId: %Schema{
          type: :string,
          description: "Correlation ID also returned in x-request-id."
        }
      },
      example: %{
        "code" => "not_found",
        "message" => "Not Found",
        "errors" => %{"detail" => "Not Found"}
      }
    },
    struct?: false,
    derive?: false
  )
end
