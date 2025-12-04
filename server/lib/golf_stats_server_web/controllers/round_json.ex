defmodule GolfStatsServerWeb.RoundJSON do
  alias GolfStatsServer.Stats.Round

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
      total_score: round.total_score
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
      putts: hole.putts
    }
  end
end
