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
    results = Bag.create_bag(user, bag_params)

    case Enum.find(results, fn r -> match?({:error, _}, r) end) do
      nil ->
        # all good
        inserted_clubs =
          Enum.map(results, fn {:ok, club} -> club end)

        conn
        |> put_status(:created)
        |> render(:index, clubs: inserted_clubs)

      {:error, changeset} ->
        # at least one insert failed
        conn
        |> put_status(:unprocessable_entity)
        |> put_view(GolfStatsServerWeb.ChangesetJSON)
        |> render("error.json", changeset: changeset)
    end
  end
end
