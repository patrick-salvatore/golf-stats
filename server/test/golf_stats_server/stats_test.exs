defmodule GolfStatsServer.StatsTest do
  use GolfStatsServer.DataCase

  alias GolfStatsServer.Stats

  describe "rounds" do
    alias GolfStatsServer.Round

    import GolfStatsServer.StatsFixtures

    @invalid_attrs %{date: nil, course_name: nil, total_score: nil}

    test "list_rounds/0 returns all rounds" do
      round = round_fixture()
      assert Stats.list_rounds() == [round]
    end

    test "get_round!/1 returns the round with given id" do
      round = round_fixture()
      assert Stats.get_round!(round.id) == round
    end

    test "create_round/1 with valid data creates a round" do
      valid_attrs = %{date: ~D[2025-12-03], course_name: "some course_name", total_score: 42}

      assert {:ok, %Round{} = round} = Stats.create_round(valid_attrs)
      assert round.date == ~D[2025-12-03]
      assert round.course_name == "some course_name"
      assert round.total_score == 42
    end

    test "create_round/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Stats.create_round(@invalid_attrs)
    end

    test "update_round/2 with valid data updates the round" do
      round = round_fixture()
      update_attrs = %{date: ~D[2025-12-04], course_name: "some updated course_name", total_score: 43}

      assert {:ok, %Round{} = round} = Stats.update_round(round, update_attrs)
      assert round.date == ~D[2025-12-04]
      assert round.course_name == "some updated course_name"
      assert round.total_score == 43
    end

    test "update_round/2 with invalid data returns error changeset" do
      round = round_fixture()
      assert {:error, %Ecto.Changeset{}} = Stats.update_round(round, @invalid_attrs)
      assert round == Stats.get_round!(round.id)
    end

    test "delete_round/1 deletes the round" do
      round = round_fixture()
      assert {:ok, %Round{}} = Stats.delete_round(round)
      assert_raise Ecto.NoResultsError, fn -> Stats.get_round!(round.id) end
    end

    test "change_round/1 returns a round changeset" do
      round = round_fixture()
      assert %Ecto.Changeset{} = Stats.change_round(round)
    end
  end

  describe "holes" do
    alias GolfStatsServer.Hole

    import GolfStatsServer.StatsFixtures

    @invalid_attrs %{hole_number: nil, par: nil, score: nil, fairway_hit: nil, gir: nil, putts: nil}

    test "list_holes/0 returns all holes" do
      hole = hole_fixture()
      assert Stats.list_holes() == [hole]
    end

    test "get_hole!/1 returns the hole with given id" do
      hole = hole_fixture()
      assert Stats.get_hole!(hole.id) == hole
    end

    test "create_hole/1 with valid data creates a hole" do
      valid_attrs = %{hole_number: 42, par: 42, score: 42, fairway_hit: true, gir: true, putts: 42}

      assert {:ok, %Hole{} = hole} = Stats.create_hole(valid_attrs)
      assert hole.hole_number == 42
      assert hole.par == 42
      assert hole.score == 42
      assert hole.fairway_hit == true
      assert hole.gir == true
      assert hole.putts == 42
    end

    test "create_hole/1 with invalid data returns error changeset" do
      assert {:error, %Ecto.Changeset{}} = Stats.create_hole(@invalid_attrs)
    end

    test "update_hole/2 with valid data updates the hole" do
      hole = hole_fixture()
      update_attrs = %{hole_number: 43, par: 43, score: 43, fairway_hit: false, gir: false, putts: 43}

      assert {:ok, %Hole{} = hole} = Stats.update_hole(hole, update_attrs)
      assert hole.hole_number == 43
      assert hole.par == 43
      assert hole.score == 43
      assert hole.fairway_hit == false
      assert hole.gir == false
      assert hole.putts == 43
    end

    test "update_hole/2 with invalid data returns error changeset" do
      hole = hole_fixture()
      assert {:error, %Ecto.Changeset{}} = Stats.update_hole(hole, @invalid_attrs)
      assert hole == Stats.get_hole!(hole.id)
    end

    test "delete_hole/1 deletes the hole" do
      hole = hole_fixture()
      assert {:ok, %Hole{}} = Stats.delete_hole(hole)
      assert_raise Ecto.NoResultsError, fn -> Stats.get_hole!(hole.id) end
    end

    test "change_hole/1 returns a hole changeset" do
      hole = hole_fixture()
      assert %Ecto.Changeset{} = Stats.change_hole(hole)
    end
  end
end
