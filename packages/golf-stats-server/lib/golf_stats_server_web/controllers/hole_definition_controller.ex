defmodule GolfStatsServerWeb.HoleDefinitionController do
  use GolfStatsServerWeb, :controller

  alias GolfStatsServer.Courses
  alias GolfStatsServer.Courses.HoleDefinition

  action_fallback(GolfStatsServerWeb.FallbackController)

  def update(conn, %{"id" => id, "hole_definition" => hole_params}) do
    hole = Courses.get_hole_definition!(id)

    with {:ok, %HoleDefinition{} = hole} <- Courses.update_hole_definition(hole, hole_params) do
      render(conn, :show, hole_definition: hole)
    end
  end
end
