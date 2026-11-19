defmodule ServerWeb.Api.Health.Router do
  use ServerWeb, :router

  scope "/", ServerWeb.Api.Health do
    get "/live", HealthController, :live
    get "/ready", HealthController, :ready
  end
end
