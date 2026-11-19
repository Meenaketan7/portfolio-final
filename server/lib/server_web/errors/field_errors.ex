defmodule ServerWeb.Errors.FieldErrors do
  @moduledoc "OpenAPI contract for validation errors grouped by field."

  alias OpenApiSpex.{Reference, Schema}
  alias ServerWeb.Errors.FieldError

  require OpenApiSpex

  @self_reference %Reference{
    "$ref": "#/components/schemas/FieldErrors"
  }

  OpenApiSpex.schema(
    %{
      title: "FieldErrors",
      description: "Field errors, including nested records and lists.",
      type: :object,
      additionalProperties: %Schema{
        oneOf: [
          %Schema{
            type: :array,
            minItems: 1,
            items: FieldError
          },
          @self_reference,
          %Schema{
            type: :array,
            minItems: 1,
            items: @self_reference
          }
        ]
      },
      example: %{
        "email" => [
          %{"code" => "required", "message" => "can't be blank"}
        ]
      }
    },
    struct?: false,
    derive?: false
  )
end
