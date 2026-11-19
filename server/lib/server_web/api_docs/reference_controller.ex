defmodule ServerWeb.ApiDocs.ReferenceController do
  @moduledoc "Serves the development Scalar interface for the generated OpenAPI document."

  use ServerWeb, :controller

  alias ServerWeb.ApiDocs.ReferenceHTML

  def show(conn, _params) do
    nonce = 16 |> :crypto.strong_rand_bytes() |> Base.encode64()
    [policy] = get_resp_header(conn, "content-security-policy")
    script_policy = "script-src 'self' https://cdn.jsdelivr.net 'nonce-#{nonce}'"

    conn
    |> put_resp_header("cache-control", "no-store")
    |> put_resp_header("content-security-policy", policy <> "; " <> script_policy)
    |> put_view(html: ReferenceHTML)
    |> put_layout(false)
    |> put_root_layout(false)
    |> render(:show, nonce: nonce)
  end
end
