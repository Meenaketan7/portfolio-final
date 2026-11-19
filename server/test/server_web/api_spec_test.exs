defmodule ServerWeb.ApiSpecTest do
  use ExUnit.Case, async: true

  import OpenApiSpex.TestAssertions, only: [assert_schema: 3]

  alias Ecto.Changeset
  alias OpenApiSpex.Schema
  alias ServerWeb.ApiSpec
  alias ServerWeb.ApiSpecFixtures.Router, as: FixtureRouter
  alias ServerWeb.Errors.ErrorFixture
  alias ServerWeb.Errors.ErrorJSON

  @feature_routers [
    {FixtureRouter, "/health", [:all, :identity, :content]},
    {FixtureRouter, "/api/v1/identity", [:all, :identity]},
    {FixtureRouter, "/api/v1/content", [:all, :content]}
  ]

  setup do
    spec = ApiSpec.spec()
    document = spec |> Jason.encode!() |> Jason.decode!()

    %{spec: spec, document: document}
  end

  test "exports API metadata with a relative server URL", %{document: document} do
    assert String.starts_with?(document["openapi"], "3.0.")
    assert %{"title" => title, "version" => version} = document["info"]
    assert is_binary(title) and title != ""
    assert is_binary(version) and version != ""
    assert [%{"url" => "/"}] = document["servers"]
    assert is_map(document["paths"])
  end

  test "registers concrete shared schemas and exports their references", %{
    spec: spec,
    document: document
  } do
    schemas = document["components"]["schemas"]

    for name <- ["ErrorResponse", "FieldErrors", "FieldError", "HealthResponse"] do
      assert %Schema{} = spec.components.schemas[name]
      assert schemas[name]["type"] == "object"
    end

    assert schemas["ErrorResponse"]["properties"]["errors"]["properties"]["fields"] == %{
             "$ref" => "#/components/schemas/FieldErrors"
           }

    assert [leaf_list, nested, nested_list] =
             schemas["FieldErrors"]["additionalProperties"]["oneOf"]

    assert leaf_list["items"] == %{"$ref" => "#/components/schemas/FieldError"}
    assert nested == %{"$ref" => "#/components/schemas/FieldErrors"}
    assert nested_list["items"] == nested
  end

  test "validates rendered errors against the real document registry", %{spec: spec} do
    for {template, assigns} <- [
          {"404.json", %{}},
          {"500.json", %{request_id: "request-id-for-api-spec"}},
          {"422.json", %{}}
        ] do
      response =
        template
        |> ErrorJSON.render(assigns)
        |> Jason.encode!()
        |> Jason.decode!()

      assert_schema(response, "ErrorResponse", spec)
    end
  end

  test "validates nested field errors through the root document", %{spec: spec} do
    valid = Changeset.change(%ErrorFixture{name: "Valid"})

    invalid =
      %ErrorFixture{}
      |> Changeset.change()
      |> Changeset.validate_required([:name])

    changeset =
      %ErrorFixture{}
      |> Changeset.change()
      |> Changeset.put_embed(:profile, invalid)
      |> Changeset.put_embed(:items, [valid, invalid])

    response =
      "422.json"
      |> ErrorJSON.render(%{changeset: changeset})
      |> Jason.encode!()
      |> Jason.decode!()

    assert [%{}, _invalid_child] = response["errors"]["fields"]["items"]
    assert_schema(response, "ErrorResponse", spec)
  end

  test "does not publish undocumented development tools", %{document: document} do
    refute Enum.any?(Map.keys(document["paths"]), &String.starts_with?(&1, "/dev/"))
  end

  test "documents the actual health operations and their exact response examples", %{
    spec: spec,
    document: document
  } do
    assert Enum.sort(Map.keys(document["paths"])) == ["/health/live", "/health/ready"]

    for {path, operation_id, responses} <- [
          {"/health/live", "healthLive", [{"200", "ok"}]},
          {"/health/ready", "healthReady", [{"200", "ok"}, {"503", "unavailable"}]}
        ] do
      operation = document["paths"][path]["get"]
      assert operation["operationId"] == operation_id
      assert operation["tags"] == ["Health"]
      assert operation["security"] == []
      assert Enum.sort(Map.keys(operation["responses"])) == Enum.map(responses, &elem(&1, 0))

      for {status_code, status} <- responses do
        response = operation["responses"][status_code]
        media_type = response["content"]["application/json"]

        assert media_type["schema"] == %{"$ref" => "#/components/schemas/HealthResponse"}
        assert media_type["example"] == %{"status" => status}
        assert_schema(media_type["example"], "HealthResponse", spec)

        assert response["headers"]["Cache-Control"]["schema"]["enum"] == ["no-store"]
        assert response["headers"]["Cache-Control"]["example"] == "no-store"
        assert response["headers"]["X-Request-Id"]["schema"]["type"] == "string"
      end
    end
  end

  test "publishes both real health paths for every server role" do
    for role <- [:all, :identity, :content] do
      paths = ApiSpec.paths_for_role(role)

      assert Enum.sort(Map.keys(paths)) == ["/health/live", "/health/ready"]
      assert paths["/health/live"].get.operationId == "healthLive"
      assert Map.has_key?(paths["/health/ready"].get.responses, 503)
    end
  end

  test "collects documented root and parameter routes at their mounted prefixes" do
    paths = ApiSpec.paths_for_role(:all, @feature_routers)

    for prefix <- ["/health", "/api/v1/identity", "/api/v1/content"] do
      assert paths[prefix].get.summary == "Fixture index"
      assert paths[prefix <> "/items/{id}"].get.summary == "Fixture detail"

      assert [%{name: :id, in: :path, required: true}] =
               paths[prefix <> "/items/{id}"].get.parameters
    end

    refute Map.has_key?(paths, "/")
    refute Map.has_key?(paths, "/items/{id}")

    operation_ids = Enum.map(paths, fn {_path, item} -> item.get.operationId end)
    assert length(operation_ids) == length(Enum.uniq(operation_ids))
  end

  test "includes health for every role and only permitted domain operations" do
    for {role, prefixes} <- [
          {:all, ["/health", "/api/v1/identity", "/api/v1/content"]},
          {:identity, ["/health", "/api/v1/identity"]},
          {:content, ["/health", "/api/v1/content"]}
        ] do
      paths = ApiSpec.paths_for_role(role, @feature_routers)
      expected = Enum.flat_map(prefixes, &[&1, &1 <> "/items/{id}"])

      assert Enum.sort(Map.keys(paths)) == Enum.sort(expected)
    end
  end

  test "resolves response schemas from forwarded operations", %{spec: spec} do
    spec =
      %{spec | paths: ApiSpec.paths_for_role(:all, @feature_routers)}
      |> OpenApiSpex.resolve_schema_modules()

    document = spec |> Jason.encode!() |> Jason.decode!()

    for path <- Map.keys(spec.paths) do
      assert document["paths"][path]["get"]["responses"]["200"]["content"]["application/json"][
               "schema"
             ] == %{"$ref" => "#/components/schemas/HealthResponse"}
    end

    assert document["components"]["schemas"]["HealthResponse"]["type"] == "object"
  end
end
