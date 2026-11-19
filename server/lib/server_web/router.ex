defmodule ServerWeb.Router do
  use ServerWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  pipeline :identity_api do
    plug ServerWeb.Plugs.RequireRole, [:all, :identity]
  end

  pipeline :content_api do
    plug ServerWeb.Plugs.RequireRole, [:all, :content]
  end

  scope "/" do
    pipe_through :api

    forward "/health", ServerWeb.Api.Health.Router
  end

  scope "/api/v1" do
    pipe_through [:identity_api, :api]

    forward "/identity", ServerWeb.Api.Identity.Router
  end

  scope "/api/v1" do
    pipe_through [:content_api, :api]

    forward "/content", ServerWeb.Api.Content.Router
  end

  # Enable API documentation, LiveDashboard, and mailbox preview in development
  if Application.compile_env(:server, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]

      live_dashboard "/dashboard", metrics: ServerWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end

    forward "/dev", ServerWeb.ApiDocs.Router
  end
end
