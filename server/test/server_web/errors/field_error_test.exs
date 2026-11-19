defmodule ServerWeb.Errors.FieldErrorTest do
  use ExUnit.Case, async: true

  import OpenApiSpex.TestAssertions, only: [assert_raw_schema: 2]

  alias Ecto.Changeset
  alias ServerWeb.Errors.ErrorJSON
  alias ServerWeb.Errors.FieldError

  test "accepts every field error produced by the renderer as JSON" do
    changeset =
      {%{}, %{name: :string, email: :string, age: :integer}}
      |> Changeset.cast(%{email: "invalid", age: "not-a-number"}, [:name, :email, :age])
      |> Changeset.validate_required([:name])
      |> Changeset.validate_format(:email, ~r/@/)

    response =
      "422.json"
      |> ErrorJSON.render(%{changeset: changeset})
      |> Jason.encode!()
      |> Jason.decode!()

    for {field, code} <- [{"name", "required"}, {"email", "invalid_format"}, {"age", "invalid"}] do
      assert [error] = response["errors"]["fields"][field]
      assert error["code"] == code
      assert_raw_schema(error, FieldError.schema())
    end
  end

  test "the documented example conforms to the schema" do
    schema = FieldError.schema()
    assert_raw_schema(schema.example, schema)
  end

  test "accepts nonempty messages in every supported language" do
    for message <- [
          "This field is required.",
          "Este campo es obligatorio.",
          "Este campo é obrigatório.",
          "Dieses Feld ist erforderlich.",
          "Ce champ est obligatoire.",
          "この項目は必須です。"
        ] do
      assert_raw_schema(%{"code" => "required", "message" => message}, FieldError.schema())
    end
  end

  test "rejects missing required properties" do
    for value <- [%{}, %{"code" => "required"}, %{"message" => "can't be blank"}] do
      assert {:error, [_ | _]} = OpenApiSpex.cast_value(value, FieldError.schema())
    end
  end

  test "rejects unsupported codes and JSON values of the wrong type" do
    for code <- ["unknown_rule", "REQUIRED", " required", "", nil, true, 123, [], %{}] do
      value = %{"code" => code, "message" => "can't be blank"}
      assert {:error, [_ | _]} = OpenApiSpex.cast_value(value, FieldError.schema())
    end
  end

  test "rejects empty messages and JSON values of the wrong type" do
    for message <- ["", nil, true, 123, [], %{}] do
      value = %{"code" => "required", "message" => message}
      assert {:error, [_ | _]} = OpenApiSpex.cast_value(value, FieldError.schema())
    end
  end

  test "rejects unexpected properties" do
    value = %{
      "code" => "required",
      "message" => "can't be blank",
      "rejectedValue" => "private-submitted-value"
    }

    assert {:error, [_ | _]} = OpenApiSpex.cast_value(value, FieldError.schema())
  end
end
