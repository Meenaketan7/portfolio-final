defmodule ServerWeb.ApiSpecFixtures.Controller do
  @moduledoc false

  use ServerWeb, :controller
  use OpenApiSpex.ControllerSpecs

  alias ServerWeb.Api.Health.HealthResponse

  operation(:index,
    summary: "Fixture index",
    responses: [ok: {"Fixture response", "application/json", HealthResponse}]
  )

  def index(conn, _params), do: json(conn, %{status: "ok"})

  operation(:show,
    summary: "Fixture detail",
    parameters: [id: [in: :path, type: :string, required: true]],
    responses: [ok: {"Fixture response", "application/json", HealthResponse}]
  )

  def show(conn, _params), do: json(conn, %{status: "ok"})
end
