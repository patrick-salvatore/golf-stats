defmodule GolfStatsServerWeb.ClubJSON do
  alias GolfStatsServer.Bag.Club

  @doc """
  Renders a list of clubs.
  """
  def index(%{clubs: clubs}) do
    %{data: for(club <- clubs, do: data(club))}
  end

  @doc """
  Renders a single club.
  """
  def show(%{club: club}) do
    %{data: data(club)}
  end

  defp data(%Club{} = club) do
    %{
      id: club.id,
      name: club.name,
      type: club.type
    }
  end
end
