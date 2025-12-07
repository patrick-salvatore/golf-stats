defmodule GolfStatsServerWeb.ClubController do
  use GolfStatsServerWeb, :controller

  alias GolfStatsServer.Bag
  alias GolfStatsServer.Bag.Club

  action_fallback(GolfStatsServerWeb.FallbackController)

  def index(conn, _params) do
    user = conn.assigns.current_user
    clubs = Bag.list_clubs(user)
    render(conn, :index, clubs: clubs)
  end

  def create(conn, %{"club" => club_params}) do
    user = conn.assigns.current_user

    with {:ok, %Club{} = club} <- Bag.create_club(user, club_params) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/clubs/#{club}")
      |> render(:show, club: club)
    end
  end

  def show(conn, %{"id" => id}) do
    club = Bag.get_club!(id)
    render(conn, :show, club: club)
  end

  def update(conn, %{"id" => id, "club" => club_params}) do
    club = Bag.get_club!(id)

    with {:ok, %Club{} = club} <- Bag.update_club(club, club_params) do
      render(conn, :show, club: club)
    end
  end

  def delete(conn, %{"id" => id}) do
    club = Bag.get_club!(id)

    with {:ok, %Club{}} <- Bag.delete_club(club) do
      send_resp(conn, :no_content, "")
    end
  end
end
