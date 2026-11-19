defmodule ServerWeb.Errors.FieldError do
  @moduledoc "OpenAPI contract for a field validation error."

  alias OpenApiSpex.Schema

  require OpenApiSpex

  OpenApiSpex.schema(
    %{
      title: "FieldError",
      description: "A validation error for one input field.",
      type: :object,
      additionalProperties: false,
      required: [:code, :message],
      properties: %{
        code: %Schema{
          type: :string,
          enum: ["required", "invalid_format", "invalid"]
        },
        message: %Schema{
          type: :string,
          minLength: 1
        }
      },
      example: %{
        "code" => "required",
        "message" => "can't be blank"
      }
    },
    struct?: false,
    derive?: false
  )
end
