import inquirer from "inquirer";
import fuzzy from "fuzzy";

inquirer.registerPrompt('checkbox-plus', require('inquirer-checkbox-plus-prompt'));

export async function elementsPrompt() {

    var elements = ['Assets', 'Galleries', 'Models', 'Content Lists', 'Pages'];
    
    return inquirer.prompt([{
            type: 'checkbox-plus',
            name: 'elements',
            message: 'Select data elements to download (space to select, enter to submit)',
            pageSize: 10,
            highlight: true,
            searchable: true,
            default: ['Assets', 'Galleries', 'Models', 'Content Lists', 'Pages'],
            source: function(answersSoFar, input) {
          
              input = input || '';
          
              return new Promise(function(resolve) {
          
                var fuzzyResult = fuzzy.filter(input, elements);
          
                var data = fuzzyResult.map(function(element) {
                  return element.original;
                });
          
                resolve(data);
                
              });
          
            }
          }]).then(answers => {\
            return answers.elements;
          }
    );


}