%{
  configs: [
    %{
      name: "default",
      strict: true,
      files: %{
        included: [
          "mix.exs",
          "config/",
          "lib/",
          "test/",
          "priv/"
        ]
      }
    }
  ]
}
