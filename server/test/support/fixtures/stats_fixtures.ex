defmodule GolfStatsServer.StatsFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `GolfStatsServer.Stats` context.
  """

  @doc """
  Generate a round.
  """
  def round_fixture(attrs \\ %{}) do
    {:ok, round} =
      attrs
      |> Enum.into(%{
        course_name: "some course_name",
        date: ~D[2025-12-03],
        total_score: 42
      })
      |> GolfStatsServer.Stats.create_round()

    round
  end

  @doc """
  Generate a hole.
  """
  def hole_fixture(attrs \\ %{}) do
    {:ok, hole} =
      attrs
      |> Enum.into(%{
        fairway_hit: true,
        gir: true,
        hole_number: 42,
        par: 42,
        putts: 42,
        score: 42
      })
      |> GolfStatsServer.Stats.create_hole()

    hole
  end
end
