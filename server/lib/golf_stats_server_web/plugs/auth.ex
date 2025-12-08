defmodule GolfStatsServerWeb.Plugs.Auth do
  import Plug.Conn
  import Phoenix.Controller

  alias GolfStatsServer.Accounts

  def init(opts), do: opts

  def call(conn, _opts) do
    case get_req_header(conn, "x-user") do
      [username | _] ->
        case Accounts.get_user_by_username(username) do
          nil ->
            conn
            |> put_status(:unauthorized)
            |> put_view(json: GolfStatsServerWeb.ErrorJSON)
            |> render(:"401")
            |> halt()

          user ->
            assign(conn, :current_user, user)
        end

      [] ->
        conn
        |> put_status(:unauthorized)
        |> put_view(json: GolfStatsServerWeb.ErrorJSON)
        |> render(:"401")
        |> halt()
    end
  end
end
