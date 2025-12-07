defmodule GolfStatsServerWeb.RoundController do
  use GolfStatsServerWeb, :controller

  alias GolfStatsServer.Stats
  alias GolfStatsServer.Round

  action_fallback(GolfStatsServerWeb.FallbackController)

  def index(conn, _params) do
    user = conn.assigns.current_user
    rounds = Stats.list_rounds(user)
    render(conn, :index, rounds: rounds)
  end

  def create(conn, %{"round" => round_params}) do
    user = conn.assigns.current_user

    with {:ok, %Round{} = round} <- Stats.create_round(user, round_params) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/rounds/#{round}")
      |> render(:show, round: round)
    end
  end

  def show(conn, %{"id" => id}) do
    round = Stats.get_round!(id)
    render(conn, :show, round: round)
  end

  def update(conn, %{"id" => id, "round" => round_params}) do
    round = Stats.get_round!(id)

    with {:ok, %Round{} = round} <- Stats.update_round(round, round_params) do
      render(conn, :show, round: round)
    end
  end

  def delete(conn, %{"id" => id}) do
    round = Stats.get_round!(id)

    with {:ok, %Round{}} <- Stats.delete_round(round) do
      send_resp(conn, :no_content, "")
    end
  end
end
