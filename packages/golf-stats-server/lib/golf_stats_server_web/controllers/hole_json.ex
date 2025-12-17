defmodule GolfStatsServerWeb.HoleJSON do
  alias GolfStatsServer.Hole

  @doc """
  Renders a list of holes.
  """
  def index(%{holes: holes}) do
    %{data: for(hole <- holes, do: data(hole))}
  end

  @doc """
  Renders a single hole.
  """
  def show(%{hole: hole}) do
    %{data: data(hole)}
  end

  defp data(%Hole{} = hole) do
    %{
      id: hole.id,
      hole_number: hole.hole_number,
      par: hole.par,
      score: hole.score,
      fairway_hit: hole.fairway_hit,
      gir: hole.gir,
      putts: hole.putts,
      fairway_status: hole.fairway_status,
      gir_status: hole.gir_status,
      fairway_bunker: hole.fairway_bunker,
      greenside_bunker: hole.greenside_bunker,
      proximity_to_hole: hole.proximity_to_hole,
      club_ids: hole.club_ids
    }
  end
end
