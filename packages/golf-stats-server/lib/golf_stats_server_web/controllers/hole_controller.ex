defmodule GolfStatsServerWeb.HoleController do
  use GolfStatsServerWeb, :controller

  alias GolfStatsServer.Stats
  alias GolfStatsServer.Hole

  action_fallback GolfStatsServerWeb.FallbackController

  def index(conn, _params) do
    holes = Stats.list_holes()
    render(conn, :index, holes: holes)
  end

  def create(conn, %{"hole" => hole_params}) do
    with {:ok, %Hole{} = hole} <- Stats.create_hole(hole_params) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/holes/#{hole}")
      |> render(:show, hole: hole)
    end
  end

  def show(conn, %{"id" => id}) do
    hole = Stats.get_hole!(id)
    render(conn, :show, hole: hole)
  end

  def update(conn, %{"id" => id, "hole" => hole_params}) do
    hole = Stats.get_hole!(id)

    with {:ok, %Hole{} = hole} <- Stats.update_hole(hole, hole_params) do
      render(conn, :show, hole: hole)
    end
  end

  def delete(conn, %{"id" => id}) do
    hole = Stats.get_hole!(id)

    with {:ok, %Hole{}} <- Stats.delete_hole(hole) do
      send_resp(conn, :no_content, "")
    end
  end
end
