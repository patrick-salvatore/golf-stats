defmodule GolfStatsServerWeb.BagJSON do
  alias GolfStatsServer.Bag.Club

  def index(%{clubs: clubs}) do
    %{
      data: for(club <- clubs, do: club_json(club))
    }
  end

  def show(%{club: club}) do
    %{data: club_json(club)}
  end

  defp club_json(%Club{id: id, name: name, type: type}) do
    %{
      id: id,
      name: name,
      type: type
    }
  end
end
