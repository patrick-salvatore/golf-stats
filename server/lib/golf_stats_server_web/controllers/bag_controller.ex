defmodule GolfStatsServerWeb.BagController do
  use GolfStatsServerWeb, :controller

  alias GolfStatsServer.Bag

  action_fallback(GolfStatsServerWeb.FallbackController)

  def index(conn, _params) do
    user = conn.assigns.current_user
    clubs = Bag.list_clubs(user)
    render(conn, :index, clubs: clubs)
  end

  def create(conn, %{"bag" => bag_params}) do
    user = conn.assigns.current_user

    case Bag.create_bag(user, bag_params) do
      {:ok, clubs} ->
        conn
        |> put_status(:created)
        |> render(:index, clubs: clubs)

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> put_view(GolfStatsServerWeb.ChangesetJSON)
        |> render("error.json", changeset: changeset)
    end
  end

  def update(conn, %{"bag" => bag_params}) do
    user = conn.assigns.current_user

    case Bag.replace_bag(user, bag_params) do
      {:ok, clubs} ->
        render(conn, :index, clubs: clubs)

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> put_view(GolfStatsServerWeb.ChangesetJSON)
        |> render("error.json", changeset: changeset)
    end
  end
end
