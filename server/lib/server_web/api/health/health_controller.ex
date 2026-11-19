defmodule ServerWeb.Api.Health.HealthController do
  use ServerWeb, :controller
  use OpenApiSpex.ControllerSpecs

  alias OpenApiSpex.{Header, Schema}
  alias Server.Health
  alias ServerWeb.Api.Health.HealthResponse

  @response_headers %{
    "Cache-Control" => %Header{
      description: "Health responses must not be cached.",
      schema: %Schema{type: :string, enum: ["no-store"]},
      example: "no-store"
    },
    "X-Request-Id" => %Header{
      description: "The request correlation ID assigned by the endpoint.",
      schema: %Schema{type: :string}
    }
  }

  tags(["Health"])
  security([])

  operation(:live,
    operation_id: "healthLive",
    summary: "Check application liveness",
    description: "Confirms the HTTP application responds without checking databases.",
    responses: [
      ok:
        {"Application is running", "application/json", HealthResponse,
         example: %{"status" => "ok"}, headers: @response_headers}
    ]
  )

  def live(conn, _params) do
    respond(conn, :ok, "ok")
  end

  operation(:ready,
    operation_id: "healthReady",
    summary: "Check application readiness",
    description:
      "Checks every repository selected for the current server role using a one-second " <>
        "timeout per query. Fails when a selected repository cannot answer or none are configured.",
    responses: [
      ok:
        {"Selected repositories are ready", "application/json", HealthResponse,
         example: %{"status" => "ok"}, headers: @response_headers},
      service_unavailable:
        {"A selected repository is unavailable or none are configured", "application/json",
         HealthResponse, example: %{"status" => "unavailable"}, headers: @response_headers}
    ]
  )

  def ready(conn, _params) do
    if Health.ready?() do
      respond(conn, :ok, "ok")
    else
      respond(conn, :service_unavailable, "unavailable")
    end
  end

  defp respond(conn, http_status, status) do
    conn
    |> put_resp_header("cache-control", "no-store")
    |> put_status(http_status)
    |> json(%{status: status})
  end
end
