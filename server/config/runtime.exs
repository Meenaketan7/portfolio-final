import Config

boolean = fn variable, default ->
  case System.get_env(variable) do
    nil -> default
    "true" -> true
    "false" -> false
    _value -> raise ArgumentError, "#{variable} must be true or false when set"
  end
end

{server_role, repos} =
  case System.get_env("SERVER_ROLE", "all") do
    "all" -> {:all, [Server.Identity.Repo, Server.Content.Repo]}
    "identity" -> {:identity, [Server.Identity.Repo]}
    "content" -> {:content, [Server.Content.Repo]}
    _value -> raise ArgumentError, "SERVER_ROLE must be all, identity, or content"
  end

# Keep existing SERVER_ROLE-only commands working when no mode is specified.
microservices = boolean.("MICROSERVICES", server_role != :all)

unless microservices == (server_role != :all) do
  raise ArgumentError,
        "MICROSERVICES=false requires SERVER_ROLE=all; MICROSERVICES=true requires SERVER_ROLE=identity or content"
end

config :server, server_role: server_role, microservices: microservices, ecto_repos: repos

# An unset flag preserves mix phx.server and the existing test configuration.
case boolean.("PHX_SERVER", nil) do
  nil -> :ok
  enabled -> config :server, ServerWeb.Endpoint, server: enabled
end

default_port = if config_env() == :test, do: "4002", else: "4000"

port =
  case Integer.parse(System.get_env("PORT", default_port)) do
    {value, ""} when value in 1..65_535 -> value
    _value -> raise ArgumentError, "PORT must be an integer between 1 and 65535"
  end

http =
  case System.get_env("PHX_IP") do
    nil ->
      if config_env() == :prod, do: [port: port, ip: {0, 0, 0, 0}], else: [port: port]

    value ->
      case :inet.parse_strict_address(String.to_charlist(value)) do
        {:ok, address} -> [port: port, ip: address]
        {:error, _reason} -> raise ArgumentError, "PHX_IP must be an IPv4 or IPv6 address"
      end
  end

config :server, ServerWeb.Endpoint, http: http

if config_env() == :prod do
  pool_size =
    case Integer.parse(System.get_env("POOL_SIZE", "1")) do
      {value, ""} when value > 0 -> value
      _value -> raise ArgumentError, "POOL_SIZE must be a positive integer"
    end

  database_path = fn variable ->
    value = System.get_env(variable)

    unless is_binary(value) and value != "" and value == String.trim(value) and
             Path.type(value) == :absolute and not String.ends_with?(value, "/") do
      raise ArgumentError, "#{variable} must be an absolute SQLite file path"
    end

    path = Path.expand(value)

    file_identity =
      case File.stat(path) do
        {:ok, %File.Stat{type: :regular} = stat} ->
          {stat.major_device, stat.minor_device, stat.inode}

        {:error, :enoent} ->
          nil

        _result ->
          raise ArgumentError, "#{variable} must refer to a regular file or a new file path"
      end

    {path, file_identity}
  end

  databases =
    for {repo, variable} <- [
          {Server.Identity.Repo, "IDENTITY_DATABASE_PATH"},
          {Server.Content.Repo, "CONTENT_DATABASE_PATH"}
        ],
        repo in repos do
      {path, file_identity} = database_path.(variable)
      {repo, path, file_identity}
    end

  paths = for {_repo, path, _identity} <- databases, do: path
  file_identities = for {_repo, _path, identity} <- databases, identity != nil, do: identity

  if length(Enum.uniq(paths)) != length(paths) or
       length(Enum.uniq(file_identities)) != length(file_identities) do
    raise ArgumentError,
          "IDENTITY_DATABASE_PATH and CONTENT_DATABASE_PATH must refer to different files"
  end

  sidecar_paths = for path <- paths, suffix <- ["-journal", "-wal", "-shm"], do: path <> suffix

  if Enum.any?(paths, &(&1 in sidecar_paths)) do
    raise ArgumentError, "A database path must not overlap another database's SQLite sidecar path"
  end

  for {repo, path, _identity} <- databases do
    config :server, repo, database: path, pool_size: pool_size
  end

  secret =
    case {System.get_env("SECRET_KEY_BASE"), System.get_env("SECRET_KEY_BASE_FILE")} do
      {value, nil} ->
        value

      {nil, path} ->
        with true <- path != "" and Path.type(path) == :absolute,
             true <- File.regular?(path),
             {:ok, contents} <- File.read(path) do
          String.trim_trailing(contents)
        else
          _result ->
            raise ArgumentError,
                  "SECRET_KEY_BASE_FILE must be an absolute path to a readable regular file"
        end

      {_value, _path} ->
        raise ArgumentError, "Set only one of SECRET_KEY_BASE or SECRET_KEY_BASE_FILE"
    end

  secret_key_base =
    case secret do
      value when is_binary(value) and byte_size(value) >= 64 ->
        value

      _value ->
        raise ArgumentError,
              "SECRET_KEY_BASE must be at least 64 bytes; generate one with mix phx.gen.secret"
    end

  host =
    with value when is_binary(value) and value != "" <- System.get_env("PHX_HOST"),
         {:ok, %URI{host: parsed_host, userinfo: nil, path: path, query: nil, fragment: nil}} <-
           URI.new("https://" <> value),
         true <- is_binary(parsed_host) and parsed_host != "" and path in [nil, ""],
         true <- value == parsed_host or value == "[#{parsed_host}]" do
      parsed_host
    else
      _value ->
        raise ArgumentError,
              "PHX_HOST is required and must be a hostname without a scheme, port, or path"
    end

  dns_cluster_query =
    case System.get_env("DNS_CLUSTER_QUERY") do
      nil -> nil
      value -> if String.trim(value) == "", do: nil, else: String.trim(value)
    end

  config :server, :dns_cluster_query, dns_cluster_query

  config :server, ServerWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    secret_key_base: secret_key_base
end
