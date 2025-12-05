defmodule GolfStatsServer.BagFixtures do
  @moduledoc """
  This module defines test helpers for creating
  entities via the `GolfStatsServer.Bag` context.
  """

  @doc """
  Generate a club.
  """
  def club_fixture(attrs \\ %{}) do
    {:ok, club} =
      attrs
      |> Enum.into(%{
        name: "some name",
        type: "some type"
      })
      |> GolfStatsServer.Bag.create_club()

    club
  end
end
