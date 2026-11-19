defmodule Server.HealthTest do
  use Server.DataCase, async: false

  alias Server.Health

  setup do
    repos = Application.fetch_env!(:server, :ecto_repos)

    on_exit(fn -> Application.put_env(:server, :ecto_repos, repos) end)

    %{repos: repos}
  end

  test "is ready when every selected repository answers" do
    assert Health.ready?()
  end

  test "checks only the selected repositories", %{repos: repos} do
    for repo <- repos do
      Application.put_env(:server, :ecto_repos, [repo])

      assert Health.ready?()
    end
  end

  test "is not ready when a selected repository is unavailable" do
    Application.put_env(:server, :ecto_repos, [__MODULE__.UnavailableRepo])

    refute Health.ready?()
  end

  test "requires every selected repository to be available", %{repos: repos} do
    Application.put_env(:server, :ecto_repos, repos ++ [__MODULE__.UnavailableRepo])

    refute Health.ready?()
  end

  test "is not ready when no repositories are selected" do
    Application.put_env(:server, :ecto_repos, [])

    refute Health.ready?()
  end
end
