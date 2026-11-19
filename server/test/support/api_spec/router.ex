defmodule ServerWeb.ApiSpecFixtures.Router do
  @moduledoc false

  use ServerWeb, :router

  scope "/", ServerWeb.ApiSpecFixtures do
    get "/", Controller, :index
    get "/items/:id", Controller, :show
  end
end
