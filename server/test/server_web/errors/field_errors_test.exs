defmodule ServerWeb.Errors.FieldErrorsTest do
  use ExUnit.Case, async: true

  import OpenApiSpex.TestAssertions, only: [assert_raw_schema: 3]

  alias Ecto.Changeset
  alias OpenApiSpex.Components
  alias OpenApiSpex.Info
  alias OpenApiSpex.OpenApi
  alias ServerWeb.Errors.ErrorFixture
  alias ServerWeb.Errors.ErrorJSON
  alias ServerWeb.Errors.FieldErrors

  setup do
    spec =
      OpenApiSpex.resolve_schema_modules(%OpenApi{
        info: %Info{title: "Validation contract", version: "1.0.0"},
        paths: %{},
        components: %Components{schemas: %{"FieldErrors" => FieldErrors.schema()}}
      })

    %{spec: spec, schema: spec.components.schemas["FieldErrors"]}
  end

  test "accepts rendered nested JSON and preserves child positions", %{schema: schema, spec: spec} do
    valid = Changeset.change(%ErrorFixture{name: "Valid"})

    invalid =
      %ErrorFixture{}
      |> Changeset.change()
      |> Changeset.validate_required([:name])

    nested =
      %ErrorFixture{name: "Nested"}
      |> Changeset.change()
      |> Changeset.put_embed(:profile, invalid)

    changeset =
      %ErrorFixture{}
      |> Changeset.change()
      |> Changeset.validate_required([:name])
      |> Changeset.put_embed(:profile, invalid)
      |> Changeset.put_embed(:items, [valid, nested])

    response =
      "422.json"
      |> ErrorJSON.render(%{changeset: changeset})
      |> Jason.encode!()
      |> Jason.decode!()

    fields = response["errors"]["fields"]
    error = %{"code" => "required", "message" => "can't be blank"}

    assert fields == %{
             "name" => [error],
             "profile" => %{"name" => [error]},
             "items" => [%{}, %{"profile" => %{"name" => [error]}}]
           }

    casted = assert_raw_schema(fields, schema, spec)
    assert [%{}, _invalid_child] = casted["items"]
  end

  test "the documented example conforms to the resolved schema", %{schema: schema, spec: spec} do
    assert_raw_schema(schema.example, schema, spec)
  end

  test "accepts an empty field map", %{schema: schema, spec: spec} do
    assert_raw_schema(%{}, schema, spec)
  end

  test "rejects a non-object root", %{schema: schema, spec: spec} do
    for value <- [nil, true, 123, "invalid", []] do
      assert {:error, [_ | _]} = OpenApiSpex.cast_value(value, schema, spec)
    end
  end

  test "rejects malformed field values and mixed array forms", %{schema: schema, spec: spec} do
    error = %{"code" => "required", "message" => "can't be blank"}

    for value <- [
          nil,
          true,
          123,
          "private input",
          [],
          error,
          [nil],
          [Map.put(error, "code", "unknown")],
          [Map.put(error, "rejectedValue", "private input")],
          [error, %{"name" => [error]}]
        ] do
      assert {:error, [_ | _]} = OpenApiSpex.cast_value(%{"email" => value}, schema, spec)
    end
  end

  test "rejects malformed leaves inside nested records and lists", %{schema: schema, spec: spec} do
    invalid_error = %{"code" => "required", "message" => ""}

    for value <- [
          %{"profile" => %{"name" => [invalid_error]}},
          %{"items" => [%{}, %{"name" => [invalid_error]}]},
          %{"profile" => %{"items" => [%{"name" => [invalid_error]}]}}
        ] do
      assert {:error, [_ | _]} = OpenApiSpex.cast_value(value, schema, spec)
    end
  end

  test "exports resolvable recursive references without runtime structs", %{spec: spec} do
    document = spec |> Jason.encode!() |> Jason.decode!()
    schemas = document["components"]["schemas"]

    assert Enum.sort(Map.keys(schemas)) == ["FieldError", "FieldErrors"]

    assert [leaf_list, nested, nested_list] =
             schemas["FieldErrors"]["additionalProperties"]["oneOf"]

    assert leaf_list["items"] == %{"$ref" => "#/components/schemas/FieldError"}
    assert nested == %{"$ref" => "#/components/schemas/FieldErrors"}
    assert nested_list["items"] == nested
    refute Map.has_key?(schemas["FieldError"], "x-struct")
    refute Map.has_key?(schemas["FieldErrors"], "x-struct")
  end
end
