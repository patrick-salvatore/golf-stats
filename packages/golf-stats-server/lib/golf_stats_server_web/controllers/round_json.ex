defmodule GolfStatsServerWeb.RoundJSON do
  alias GolfStatsServer.Round

  @doc """
  Renders a list of rounds.
  """
  def index(%{rounds: rounds}) do
    %{data: for(round <- rounds, do: data(round))}
  end

  @doc """
  Renders a single round.
  """
  def show(%{round: round}) do
    %{data: data(round)}
  end

  defp data(%Round{} = round) do
    data = %{
      id: round.id,
      course_name: round.course_name,
      date: round.date,
      total_score: round.total_score,
      created_at: round.created_at,
      ended_at: round.ended_at
    }

    if Ecto.assoc_loaded?(round.holes) do
      Map.put(data, :holes, Enum.map(round.holes, &data_hole/1))
    else
      data
    end
  end

  defp data_hole(hole) do
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
