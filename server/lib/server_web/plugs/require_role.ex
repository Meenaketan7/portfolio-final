defmodule ServerWeb.Plugs.RequireRole do
  @moduledoc false
  @behaviour Plug

  import Plug.Conn

  alias ServerWeb.Errors.ErrorJSON

  @impl true
  def init(allowed_roles), do: allowed_roles

  @impl true
  def call(conn, allowed_roles) do
    if Application.fetch_env!(:server, :server_role) in allowed_roles do
      conn
    else
      body =
        ErrorJSON.render("404.json", conn.assigns)
        |> Jason.encode!()

      conn
      |> put_resp_content_type("application/json")
      |> send_resp(404, body)
      |> halt()
    end
  end
end
