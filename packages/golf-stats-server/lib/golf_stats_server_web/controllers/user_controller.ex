defmodule GolfStatsServerWeb.UserController do
  use GolfStatsServerWeb, :controller

  alias GolfStatsServer.Accounts
  alias GolfStatsServer.Accounts.User

  action_fallback(GolfStatsServerWeb.FallbackController)

  def create(conn, %{"username" => username}) do
    case Accounts.get_user_by_username(username) do
      nil ->
        case Accounts.create_user(%{username: username}) do
          {:ok, user} ->
            conn
            |> put_status(:created)
            |> render(:show, user: user)

          {:error, changeset} ->
            conn
            |> put_status(:unprocessable_entity)
            |> put_view(GolfStatsServerWeb.ChangesetJSON)
            |> render("error.json", changeset: changeset)
        end

      %User{} = user ->
        conn
        |> put_status(:ok)
        |> render(:show, user: user)
    end
  end

  def me(conn, _params) do
    user = conn.assigns.current_user
    render(conn, :show, user: user)
  end
end
