#pragma once

#include <memory>
#include <mutex>
#include <sstream>
#include <string>
#include <vector>

#include "engine.h"

using namespace Stockfish;

class StockfishWrapper
{
  public:
    StockfishWrapper();

    void execute(const std::string& message);
    std::string getOutput();

  private:
    std::unique_ptr<Engine> engine;
    std::vector<std::string> outputBuffer;
    std::mutex outputMutex;

    void pushOutput(const std::string& line);
    void clearOutput();
    void setupCallbacks();
    void parsePosition(std::istringstream& is);
};
