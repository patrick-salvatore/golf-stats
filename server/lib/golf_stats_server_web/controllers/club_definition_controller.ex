defmodule GolfStatsServerWeb.ClubDefinitionController do
  use GolfStatsServerWeb, :controller

  alias GolfStatsServer.Bag

  action_fallback GolfStatsServerWeb.FallbackController

  def index(conn, _params) do
    club_definitions = Bag.list_club_definitions()
    render(conn, :index, club_definitions: club_definitions)
  end
end
