defmodule GolfStatsServerWeb.StatsController do
  use GolfStatsServerWeb, :controller

  alias GolfStatsServer.Stats

  action_fallback(GolfStatsServerWeb.FallbackController)

  def dashboard(conn, _params) do
    stats = Stats.get_dashboard_stats()
    json(conn, %{data: stats})
  end
end
