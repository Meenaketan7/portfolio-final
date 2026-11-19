defmodule Server.Health do
  @moduledoc "Checks database readiness for the selected backend repositories."

  alias Ecto.Adapters.SQL

  @spec ready?() :: boolean()
  def ready? do
    repos = Application.fetch_env!(:server, :ecto_repos)

    repos != [] and Enum.all?(repos, &repo_ready?/1)
  end

  defp repo_ready?(repo) do
    case SQL.query(repo, "SELECT 1", [], timeout: 1_000, log: false) do
      {:ok, %{rows: [[1]]}} -> true
      {:error, _reason} -> false
    end
  rescue
    _error -> false
  catch
    :exit, _reason -> false
  end
end
