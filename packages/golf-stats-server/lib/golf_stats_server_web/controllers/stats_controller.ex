defmodule GolfStatsServerWeb.StatsController do
  use GolfStatsServerWeb, :controller

  alias GolfStatsServer.Stats

  action_fallback(GolfStatsServerWeb.FallbackController)

  def dashboard(conn, _params) do
    user = conn.assigns.current_user
    stats = Stats.get_dashboard_stats(user)
    json(conn, %{data: stats})
  end
end
