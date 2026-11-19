defmodule Server.RuntimeConfigTest do
  use ExUnit.Case, async: false

  @runtime_config Path.expand("../../config/runtime.exs", __DIR__)

  setup do
    names = [
      "PHX_SERVER",
      "MICROSERVICES",
      "SERVER_ROLE",
      "PORT",
      "PHX_IP",
      "POOL_SIZE",
      "IDENTITY_DATABASE_PATH",
      "CONTENT_DATABASE_PATH",
      "SECRET_KEY_BASE",
      "SECRET_KEY_BASE_FILE",
      "PHX_HOST",
      "DNS_CLUSTER_QUERY"
    ]

    original_env = Map.new(names, &{&1, System.get_env(&1)})

    fixture_dir =
      Path.expand(
        "../../tmp/runtime-config-#{System.unique_integer([:positive, :monotonic])}",
        __DIR__
      )

    on_exit(fn ->
      Enum.each(original_env, fn
        {name, nil} -> System.delete_env(name)
        {name, value} -> System.put_env(name, value)
      end)

      File.rm_rf!(fixture_dir)
    end)

    File.mkdir_p!(fixture_dir)
    System.delete_env("PHX_SERVER")
    System.delete_env("MICROSERVICES")
    System.delete_env("PHX_IP")
    System.delete_env("POOL_SIZE")
    System.delete_env("SECRET_KEY_BASE_FILE")
    System.delete_env("DNS_CLUSTER_QUERY")
    System.put_env("SERVER_ROLE", "all")
    System.put_env("PORT", "4000")
    System.put_env("SECRET_KEY_BASE", String.duplicate("test-only-", 8))
    System.put_env("PHX_HOST", "example.test")

    for {name, filename} <- [
          {"IDENTITY_DATABASE_PATH", "identity.db"},
          {"CONTENT_DATABASE_PATH", "content.db"}
        ] do
      System.put_env(name, Path.join(fixture_dir, filename))
    end

    {:ok, fixture_dir: fixture_dir}
  end

  test "defaults to the combined role and monolith mode when both settings are unset" do
    System.delete_env("SERVER_ROLE")
    config = runtime_config(:prod)

    assert Keyword.fetch!(config, :server_role) == :all
    assert Keyword.fetch!(config, :ecto_repos) == [Server.Identity.Repo, Server.Content.Repo]
    refute Keyword.fetch!(config, :microservices)
  end

  test "infers the deployment mode from existing role-only configuration" do
    for {role, expected_role, expected_repos, microservices} <- [
          {"all", :all, [Server.Identity.Repo, Server.Content.Repo], false},
          {"identity", :identity, [Server.Identity.Repo], true},
          {"content", :content, [Server.Content.Repo], true}
        ],
        env <- [:dev, :test, :prod] do
      System.put_env("SERVER_ROLE", role)
      config = runtime_config(env)

      assert Keyword.fetch!(config, :server_role) == expected_role
      assert Keyword.fetch!(config, :ecto_repos) == expected_repos
      assert Keyword.fetch!(config, :microservices) == microservices
    end
  end

  test "accepts explicit deployment modes with their matching roles" do
    for {mode, role, expected} <- [
          {"false", "all", false},
          {"true", "identity", true},
          {"true", "content", true}
        ] do
      System.put_env("MICROSERVICES", mode)
      System.put_env("SERVER_ROLE", role)

      assert Keyword.fetch!(runtime_config(:prod), :microservices) == expected
    end
  end

  test "rejects invalid deployment mode flags" do
    for value <- ["", "TRUE", "FALSE", "1", "yes"] do
      System.put_env("MICROSERVICES", value)

      assert_raise ArgumentError, ~r/MICROSERVICES.*true.*false/, fn ->
        runtime_config(:prod)
      end
    end
  end

  test "rejects deployment modes that contradict the selected role" do
    for {mode, role} <- [{"false", "identity"}, {"false", "content"}, {"true", "all"}] do
      System.put_env("MICROSERVICES", mode)
      System.put_env("SERVER_ROLE", role)

      assert_raise ArgumentError,
                   "MICROSERVICES=false requires SERVER_ROLE=all; MICROSERVICES=true requires SERVER_ROLE=identity or content",
                   fn -> runtime_config(:prod) end
    end
  end

  test "rejects invalid service roles with a clear error" do
    for role <- ["", "unknown", "ALL", "Identity"] do
      System.put_env("SERVER_ROLE", role)

      assert_raise ArgumentError, "SERVER_ROLE must be all, identity, or content", fn ->
        runtime_config(:prod)
      end
    end
  end

  test "leaves the existing server setting unchanged when PHX_SERVER is unset" do
    refute Keyword.has_key?(endpoint_config(), :server)
  end

  test "enables the HTTP server when PHX_SERVER is true" do
    System.put_env("PHX_SERVER", "true")

    assert Keyword.fetch!(endpoint_config(), :server) == true
  end

  test "disables the HTTP server when PHX_SERVER is false" do
    System.put_env("PHX_SERVER", "false")

    assert Keyword.fetch!(endpoint_config(), :server) == false
  end

  test "rejects invalid PHX_SERVER values with a clear error" do
    for value <- ["", "TRUE", "FALSE", "1", "yes"] do
      System.put_env("PHX_SERVER", value)

      assert_raise ArgumentError, "PHX_SERVER must be true or false when set", fn ->
        endpoint_config()
      end
    end
  end

  test "preserves the environment's default HTTP port when PORT is unset" do
    System.delete_env("PORT")

    for {env, expected} <- [{:dev, 4000}, {:test, 4002}, {:prod, 4000}] do
      assert get_in(runtime_config(env), [ServerWeb.Endpoint, :http, :port]) == expected
    end
  end

  test "accepts configured HTTP ports including the range boundaries" do
    for port <- [1, 4001, 65_535] do
      System.put_env("PORT", Integer.to_string(port))

      assert get_in(endpoint_config(), [:http, :port]) == port
    end
  end

  test "rejects malformed and out-of-range HTTP ports" do
    for value <- ["", "abc", "4000abc", "4000.5", "0", "-1", "65536", " 4000", "4000 "] do
      System.put_env("PORT", value)

      assert_raise ArgumentError, "PORT must be an integer between 1 and 65535", fn ->
        endpoint_config()
      end
    end
  end

  test "defaults production to IPv4 and preserves development and test bind settings" do
    assert get_in(runtime_config(:prod), [ServerWeb.Endpoint, :http, :ip]) == {0, 0, 0, 0}

    for env <- [:dev, :test] do
      config = runtime_config(env)

      refute Keyword.has_key?(get_in(config, [ServerWeb.Endpoint, :http]), :ip)
    end
  end

  test "accepts explicit IPv4 and IPv6 bind addresses in every environment" do
    for {value, expected} <- [
          {"127.0.0.1", {127, 0, 0, 1}},
          {"0.0.0.0", {0, 0, 0, 0}},
          {"::1", {0, 0, 0, 0, 0, 0, 0, 1}},
          {"::", {0, 0, 0, 0, 0, 0, 0, 0}}
        ],
        env <- [:dev, :test, :prod] do
      System.put_env("PHX_IP", value)

      assert get_in(runtime_config(env), [ServerWeb.Endpoint, :http, :ip]) == expected
    end
  end

  test "rejects invalid and ambiguous bind addresses" do
    for value <- [
          "",
          " ",
          "localhost",
          "127.0.0.999",
          "127.1",
          "0x7f.0.0.1",
          "0127.0.0.1",
          "[::1]",
          "127.0.0.1:4000",
          "::g"
        ] do
      System.put_env("PHX_IP", value)

      assert_raise ArgumentError, "PHX_IP must be an IPv4 or IPv6 address", fn ->
        runtime_config(:prod)
      end
    end
  end

  test "defaults each production repository to one connection when POOL_SIZE is unset" do
    config = runtime_config(:prod)

    assert get_in(config, [Server.Identity.Repo, :pool_size]) == 1
    assert get_in(config, [Server.Content.Repo, :pool_size]) == 1
  end

  test "applies a positive POOL_SIZE to both active production repositories" do
    for size <- [1, 3] do
      System.put_env("POOL_SIZE", Integer.to_string(size))
      config = runtime_config(:prod)

      assert get_in(config, [Server.Identity.Repo, :pool_size]) == size
      assert get_in(config, [Server.Content.Repo, :pool_size]) == size
    end
  end

  test "rejects malformed and non-positive production pool sizes" do
    for value <- ["", "abc", "2abc", "1.5", "0", "-1", " 2", "2 "] do
      System.put_env("POOL_SIZE", value)

      assert_raise ArgumentError, "POOL_SIZE must be a positive integer", fn ->
        runtime_config(:prod)
      end
    end
  end

  test "does not apply production pool overrides in development or test" do
    System.put_env("POOL_SIZE", "invalid")

    for env <- [:dev, :test] do
      config = runtime_config(env)

      refute Keyword.has_key?(config, Server.Identity.Repo)
      refute Keyword.has_key?(config, Server.Content.Repo)
    end
  end

  test "requires only the database path belonging to the selected production role", %{
    fixture_dir: fixture_dir
  } do
    for {role, required, unused, repo} <- [
          {"identity", "IDENTITY_DATABASE_PATH", "CONTENT_DATABASE_PATH", Server.Identity.Repo},
          {"content", "CONTENT_DATABASE_PATH", "IDENTITY_DATABASE_PATH", Server.Content.Repo}
        ] do
      path = Path.join(fixture_dir, "#{role}.db")
      System.put_env("SERVER_ROLE", role)
      System.put_env(required, path)
      System.delete_env(unused)
      config = runtime_config(:prod)

      assert Keyword.fetch!(config, :ecto_repos) == [repo]
      assert get_in(config, [repo, :database]) == path

      System.put_env(unused, "invalid-relative-path")

      assert get_in(runtime_config(:prod), [repo, :database]) == path
    end
  end

  test "rejects a missing database path for either selected production role" do
    for {role, variable} <- [
          {"identity", "IDENTITY_DATABASE_PATH"},
          {"content", "CONTENT_DATABASE_PATH"}
        ] do
      System.put_env("SERVER_ROLE", role)
      System.delete_env(variable)

      assert_raise ArgumentError, ~r/#{variable}/, fn -> runtime_config(:prod) end
    end
  end

  test "rejects blank, relative, in-memory, and malformed production paths", %{
    fixture_dir: fixture_dir
  } do
    for {role, variable} <- [
          {"identity", "IDENTITY_DATABASE_PATH"},
          {"content", "CONTENT_DATABASE_PATH"}
        ],
        value <- [
          "",
          " ",
          "identity.db",
          ":memory:",
          "file::memory:?cache=shared",
          " " <> Path.join(fixture_dir, "identity.db"),
          Path.join(fixture_dir, "identity.db") <> " ",
          Path.join(fixture_dir, "new-directory") <> "/"
        ] do
      System.put_env("SERVER_ROLE", role)
      System.put_env(variable, value)

      assert_raise ArgumentError, ~r/#{variable}/, fn -> runtime_config(:prod) end
    end
  end

  test "normalizes absolute paths without creating databases or directories", %{
    fixture_dir: fixture_dir
  } do
    path = Path.join([fixture_dir, "uncreated", "identity.db"])
    configured_path = Path.join([fixture_dir, "nested", "..", "uncreated", "identity.db"])
    System.put_env("IDENTITY_DATABASE_PATH", configured_path)

    assert get_in(runtime_config(:prod), [Server.Identity.Repo, :database]) == path
    refute File.exists?(Path.dirname(path))
    refute File.exists?(path)
  end

  test "rejects existing directories and special files as database targets", %{
    fixture_dir: fixture_dir
  } do
    for {role, variable} <- [
          {"identity", "IDENTITY_DATABASE_PATH"},
          {"content", "CONTENT_DATABASE_PATH"}
        ],
        path <- [fixture_dir, "/", "/dev/null"] do
      System.put_env("SERVER_ROLE", role)
      System.put_env(variable, path)

      assert_raise ArgumentError, ~r/#{variable}/, fn -> runtime_config(:prod) end
    end
  end

  test "rejects database paths that normalize to the same file", %{fixture_dir: fixture_dir} do
    System.put_env("IDENTITY_DATABASE_PATH", Path.join(fixture_dir, "shared.db"))

    System.put_env(
      "CONTENT_DATABASE_PATH",
      Path.join([fixture_dir, "nested", "..", "shared.db"])
    )

    assert_raise ArgumentError,
                 "IDENTITY_DATABASE_PATH and CONTENT_DATABASE_PATH must refer to different files",
                 fn -> runtime_config(:prod) end
  end

  test "rejects database paths that overlap SQLite sidecar paths", %{fixture_dir: fixture_dir} do
    database = Path.join(fixture_dir, "database.db")

    for suffix <- ["-journal", "-wal", "-shm"],
        {identity, content} <- [{database, database <> suffix}, {database <> suffix, database}] do
      System.put_env("IDENTITY_DATABASE_PATH", identity)
      System.put_env("CONTENT_DATABASE_PATH", content)

      assert_raise ArgumentError,
                   "A database path must not overlap another database's SQLite sidecar path",
                   fn -> runtime_config(:prod) end
    end
  end

  test "rejects existing database files that are hard links to the same file", %{
    fixture_dir: fixture_dir
  } do
    original = Path.join(fixture_dir, "original.db")
    linked = Path.join(fixture_dir, "linked.db")
    File.write!(original, "test fixture")
    File.ln!(original, linked)
    System.put_env("IDENTITY_DATABASE_PATH", original)
    System.put_env("CONTENT_DATABASE_PATH", linked)

    assert_raise ArgumentError,
                 "IDENTITY_DATABASE_PATH and CONTENT_DATABASE_PATH must refer to different files",
                 fn -> runtime_config(:prod) end
  end

  test "rejects existing database files that are symbolic links to the same file", %{
    fixture_dir: fixture_dir
  } do
    original = Path.join(fixture_dir, "original.db")
    linked = Path.join(fixture_dir, "linked.db")
    File.write!(original, "test fixture")
    File.ln_s!(original, linked)
    System.put_env("IDENTITY_DATABASE_PATH", original)
    System.put_env("CONTENT_DATABASE_PATH", linked)

    assert_raise ArgumentError,
                 "IDENTITY_DATABASE_PATH and CONTENT_DATABASE_PATH must refer to different files",
                 fn -> runtime_config(:prod) end
  end

  test "preserves production secrets at and above the minimum byte length" do
    for secret <- [String.duplicate("a", 64), String.duplicate("test-only-", 8)] do
      System.put_env("SECRET_KEY_BASE", secret)

      assert get_in(runtime_config(:prod), [ServerWeb.Endpoint, :secret_key_base]) == secret
    end
  end

  test "rejects a missing production secret" do
    System.delete_env("SECRET_KEY_BASE")

    assert_raise ArgumentError,
                 "SECRET_KEY_BASE must be at least 64 bytes; generate one with mix phx.gen.secret",
                 fn -> runtime_config(:prod) end
  end

  test "rejects empty and short production secrets without including their values" do
    for secret <- ["", "private-test-value", String.duplicate("a", 63)] do
      System.put_env("SECRET_KEY_BASE", secret)

      assert_raise ArgumentError,
                   "SECRET_KEY_BASE must be at least 64 bytes; generate one with mix phx.gen.secret",
                   fn -> runtime_config(:prod) end
    end
  end

  test "leaves development and test secrets to their existing configuration" do
    System.put_env("SECRET_KEY_BASE", "short")

    for env <- [:dev, :test] do
      config = runtime_config(env)

      refute Keyword.has_key?(Keyword.fetch!(config, ServerWeb.Endpoint), :secret_key_base)
    end
  end

  test "loads a production secret file and removes trailing file whitespace", %{
    fixture_dir: fixture_dir
  } do
    path = Path.join(fixture_dir, "secret.key")
    System.delete_env("SECRET_KEY_BASE")
    System.put_env("SECRET_KEY_BASE_FILE", path)

    for secret <- [String.duplicate("a", 64), String.duplicate("test-only-", 8)] do
      File.write!(path, secret <> "\r\n")

      assert get_in(runtime_config(:prod), [ServerWeb.Endpoint, :secret_key_base]) == secret
    end
  end

  test "rejects conflicting inline and file secret sources", %{fixture_dir: fixture_dir} do
    path = Path.join(fixture_dir, "secret.key")
    File.write!(path, String.duplicate("test-only-", 8))
    System.put_env("SECRET_KEY_BASE_FILE", path)

    assert_raise ArgumentError, "Set only one of SECRET_KEY_BASE or SECRET_KEY_BASE_FILE", fn ->
      runtime_config(:prod)
    end
  end

  test "requires a readable regular secret file at an absolute path", %{fixture_dir: fixture_dir} do
    path = Path.join(fixture_dir, "secret.key")
    File.write!(path, String.duplicate("test-only-", 8))
    relative_path = Path.relative_to(path, File.cwd!())
    assert Path.type(relative_path) == :relative
    System.delete_env("SECRET_KEY_BASE")

    for source <- ["", relative_path, fixture_dir, Path.join(fixture_dir, "missing.key")] do
      System.put_env("SECRET_KEY_BASE_FILE", source)

      assert_raise ArgumentError,
                   "SECRET_KEY_BASE_FILE must be an absolute path to a readable regular file",
                   fn -> runtime_config(:prod) end
    end
  end

  test "applies the minimum secret length to file contents without exposing them", %{
    fixture_dir: fixture_dir
  } do
    path = Path.join(fixture_dir, "secret.key")
    System.delete_env("SECRET_KEY_BASE")
    System.put_env("SECRET_KEY_BASE_FILE", path)

    for value <- ["", " \r\n", "private-test-value", String.duplicate("a", 63) <> "\n"] do
      File.write!(path, value)

      assert_raise ArgumentError,
                   "SECRET_KEY_BASE must be at least 64 bytes; generate one with mix phx.gen.secret",
                   fn -> runtime_config(:prod) end
    end
  end

  test "does not load production secret files in development or test" do
    System.put_env("SECRET_KEY_BASE_FILE", "invalid-relative-path")

    for env <- [:dev, :test] do
      config = runtime_config(env)

      refute Keyword.has_key?(Keyword.fetch!(config, ServerWeb.Endpoint), :secret_key_base)
    end
  end

  test "accepts explicit production hosts and normalizes bracketed IPv6 addresses" do
    for {value, expected_host} <- [
          {"example.test", "example.test"},
          {"API.example.test", "API.example.test"},
          {"localhost", "localhost"},
          {"127.0.0.1", "127.0.0.1"},
          {"[::1]", "::1"},
          {"[2001:db8::1]", "2001:db8::1"}
        ] do
      System.put_env("PHX_HOST", value)

      assert get_in(runtime_config(:prod), [ServerWeb.Endpoint, :url]) ==
               [host: expected_host, port: 443, scheme: "https"]
    end
  end

  test "requires PHX_HOST in production instead of using a placeholder" do
    System.delete_env("PHX_HOST")

    assert_raise ArgumentError,
                 "PHX_HOST is required and must be a hostname without a scheme, port, or path",
                 fn -> runtime_config(:prod) end
  end

  test "rejects blank production hosts and values containing URL components" do
    for value <- [
          "",
          " ",
          "bad host",
          " example.test",
          "example.test ",
          "https://example.test",
          "example.test:443",
          "example.test/",
          "example.test/path",
          "example.test?query=1",
          "example.test#fragment",
          "user:password@example.test",
          "example.test\\path",
          "[invalid]",
          "[::1]:443",
          "::1"
        ] do
      System.put_env("PHX_HOST", value)

      assert_raise ArgumentError,
                   "PHX_HOST is required and must be a hostname without a scheme, port, or path",
                   fn -> runtime_config(:prod) end
    end
  end

  test "does not require a production hostname in development or test" do
    System.delete_env("PHX_HOST")

    for env <- [:dev, :test] do
      config = runtime_config(env)

      refute Keyword.has_key?(Keyword.fetch!(config, ServerWeb.Endpoint), :url)
    end
  end

  test "disables DNS clustering for an unset or blank production query" do
    assert Keyword.get(runtime_config(:prod), :dns_cluster_query) == nil

    for value <- ["", " ", "\t\r\n"] do
      System.put_env("DNS_CLUSTER_QUERY", value)

      assert Keyword.get(runtime_config(:prod), :dns_cluster_query) == nil
    end
  end

  test "trims the optional production DNS query without resolving it" do
    System.put_env("DNS_CLUSTER_QUERY", "  server.internal.\r\n")

    assert Keyword.fetch!(runtime_config(:prod), :dns_cluster_query) == "server.internal."
  end

  test "does not apply production DNS clustering configuration in development or test" do
    System.put_env("DNS_CLUSTER_QUERY", "server.internal")

    for env <- [:dev, :test] do
      refute Keyword.has_key?(runtime_config(env), :dns_cluster_query)
    end
  end

  defp endpoint_config do
    :test
    |> runtime_config()
    |> Keyword.fetch!(ServerWeb.Endpoint)
  end

  defp runtime_config(env) do
    @runtime_config
    |> Config.Reader.read!(env: env)
    |> Keyword.fetch!(:server)
  end
end
