defmodule GolfStatsServer.BagTest do
  use GolfStatsServer.DataCase

  alias GolfStatsServer.Bag

  describe "clubs" do
    alias GolfStatsServer.Bag.Club

    import GolfStatsServer.BagFixtures

    @invalid_attrs %{name: nil, type: nil}

    test "list_clubs/0 returns all clubs" do
      club = club_fixture()
      assert Bag.list_clubs() == [club]
    end

    test "get_club!/1 returns the club with given id" do
      club = club_fixture()
      assert Bag.get_club!(club.id) == club
    end

    test "create_club/1 with valid data creates a club" do
      valid_attrs = %{name: "some name", type: "some type"}

      assert {:ok, %Club{} = club} = Bag.create_club(valid_attrs)
      assert club.name == "some name"
      assert club.type == "some type"
    end

    test "create_club/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Bag.create_club(@invalid_attrs)
    end

    test "update_club/2 with valid data updates the club" do
      club = club_fixture()
      update_attrs = %{name: "some updated name", type: "some updated type"}

      assert {:ok, %Club{} = club} = Bag.update_club(club, update_attrs)
      assert club.name == "some updated name"
      assert club.type == "some updated type"
    end

    test "update_club/2 with invalid data returns error changeset" do
      club = club_fixture()
      assert {:error, %Ecto.Changeset{}} = Bag.update_club(club, @invalid_attrs)
      assert club == Bag.get_club!(club.id)
    end

    test "delete_club/1 deletes the club" do
      club = club_fixture()
      assert {:ok, %Club{}} = Bag.delete_club(club)
      assert_raise Ecto.NoResultsError, fn -> Bag.get_club!(club.id) end
    end

    test "change_club/1 returns a club changeset" do
      club = club_fixture()
      assert %Ecto.Changeset{} = Bag.change_club(club)
    end
  end
end
