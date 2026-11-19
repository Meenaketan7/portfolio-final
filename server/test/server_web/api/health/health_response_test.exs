defmodule ServerWeb.Api.Health.HealthResponseTest do
  use ExUnit.Case, async: true

  import OpenApiSpex.TestAssertions, only: [assert_raw_schema: 2]

  alias ServerWeb.Api.Health.HealthResponse

  test "the documented example conforms to the schema" do
    schema = HealthResponse.schema()
    assert_raw_schema(schema.example, schema)
  end

  test "rejects a missing status or non-object body" do
    for value <- [%{}, nil, true, 123, "ok", []] do
      assert {:error, [_ | _]} = OpenApiSpex.cast_value(value, HealthResponse.schema())
    end
  end

  test "rejects unsupported status values and incorrect JSON types" do
    for status <- ["", "ready", "OK", "ok ", nil, true, 123, [], %{}] do
      assert {:error, [_ | _]} =
               OpenApiSpex.cast_value(%{"status" => status}, HealthResponse.schema())
    end
  end

  test "rejects extra properties containing infrastructure details" do
    value = %{"status" => "unavailable", "database" => "private database path"}

    assert {:error, [_ | _]} = OpenApiSpex.cast_value(value, HealthResponse.schema())
  end
end
