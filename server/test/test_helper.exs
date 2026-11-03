ExUnit.start()

Enum.each(Application.fetch_env!(:server, :ecto_repos), fn repo ->
  Ecto.Adapters.SQL.Sandbox.mode(repo, :manual)
end)
