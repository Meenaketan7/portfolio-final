defmodule ServerWeb.Errors.ErrorJSON do
  @moduledoc """
  This module is invoked by your endpoint in case of errors on JSON requests.

  See config/config.exs.
  """

  # If you want to customize a particular status code,
  # you may add your own clauses, such as:
  #
  # def render("500.json", _assigns) do
  #   %{errors: %{detail: "Internal Server Error"}}
  # end

  # By default, Phoenix returns the status message from
  # the template name. For example, "404.json" becomes
  # "Not Found".
  use Gettext, backend: ServerWeb.Gettext

  @error_codes %{
    "400.json" => "bad_request",
    "401.json" => "unauthorized",
    "403.json" => "forbidden",
    "404.json" => "not_found",
    "405.json" => "method_not_allowed",
    "406.json" => "not_acceptable",
    "409.json" => "conflict",
    "410.json" => "gone",
    "413.json" => "payload_too_large",
    "415.json" => "unsupported_media_type",
    "422.json" => "validation_failed",
    "429.json" => "rate_limited",
    "500.json" => "internal_server_error",
    "502.json" => "bad_gateway",
    "503.json" => "service_unavailable",
    "504.json" => "gateway_timeout"
  }

  def render(template, assigns) do
    message = Phoenix.Controller.status_message_from_template(template)

    response = %{
      code: Map.get(@error_codes, template, "request_failed"),
      message: message,
      errors: %{detail: message}
    }

    response = put_field_errors(response, template, assigns)

    case assigns do
      %{request_id: request_id} when is_binary(request_id) ->
        if String.valid?(request_id),
          do: Map.put(response, :requestId, request_id),
          else: response

      _ ->
        response
    end
  end

  defp put_field_errors(
         response,
         "422.json",
         %{changeset: %Ecto.Changeset{} = changeset}
       ) do
    fields =
      changeset
      |> Ecto.Changeset.traverse_errors(&field_error_code/1)
      |> format_field_errors()

    put_in(response, [:errors, :fields], fields)
  end

  defp put_field_errors(response, _template, _assigns), do: response

  defp field_error_code({_message, options}) do
    case Keyword.get(options, :validation) do
      :required -> "required"
      :format -> "invalid_format"
      _ -> "invalid"
    end
  end

  defp format_field_errors(fields) when is_map(fields) do
    Map.new(fields, fn {field, errors} ->
      {field, format_field_errors(errors)}
    end)
  end

  defp format_field_errors(errors) when is_list(errors) do
    Enum.map(errors, &format_field_errors/1)
  end

  defp format_field_errors(code) do
    message =
      case code do
        "required" -> dgettext("errors", "can't be blank")
        "invalid_format" -> dgettext("errors", "has invalid format")
        _ -> dgettext("errors", "is invalid")
      end

    %{code: code, message: message}
  end
end
