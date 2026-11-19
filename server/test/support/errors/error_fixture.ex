defmodule ServerWeb.Errors.ErrorFixture do
  @moduledoc false

  use Ecto.Schema

  embedded_schema do
    field :name, :string
    embeds_one :profile, __MODULE__
    embeds_many :items, __MODULE__
  end
end
